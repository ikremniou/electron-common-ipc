const testTimeout = 2000;

const IpcBusProcessType = {
    Native: 0,
    Node: 1,
    Renderer: 2,
    Worker: 3,
    Undefined: 4,
    Browser: 5,
    Main: 6
}

function isArrayBuffer(value) {
    return (value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]');
  }

function pairwise(list) {
    if (list.length < 2) { return []; }
    var first = list[0],
        rest  = list.slice(1),
        pairs = rest.map(function (x) { return [first, x]; });
    return pairs.concat(pairwise(rest));
}

function onlyUnique(value, index, self) {
    return self.findIndex((target) => target.peer.id === value.peer.id) === index;
}

function Uint8ArrayToBuffer(rawBuffer) {
    // See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
    // To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer
    const arr = rawBuffer;
    rawBuffer = Buffer.from(arr.buffer);
    if (arr.byteLength !== arr.buffer.byteLength) {
        // Respect the "view", i.e. byteOffset and byteLength, without doing a copy
        rawBuffer = rawBuffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
    }
    return rawBuffer;
}

const uuidPattern = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

var PerfTests = function _PerfTests(type, busPath) {
    this.connect = function(peerName, view) {
        _ipcBus.connect(busPath, { peerName })
            .then(() => {
                if (view) {
                    _ipcBus.on('test-performance-start', (ipcBusEvent, ...args) => this.onIPCBus_CollectStart(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-stop', (ipcBusEvent, ...args) => this.onIPCBus_CollectStop(ipcBusEvent, ...args));
                }
                else {
                    _ipcBus.on('test-performance-ping', (ipcBusEvent, ...args) => this.onIPCBus_TestPerformancePing(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-trace', (ipcBusEvent, ...args) => this.onIPCBus_TestPerformanceTrace(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-from-' + _uuid, (ipcBusEvent, ...args) => this.onIPCBus_TestPerformanceRun(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-to-'+ _uuid, (ipcBusEvent, ...args) => this.onIPCBus_TestPerformance(ipcBusEvent, ...args));
                }
            });
    }

    this.onIPCBus_TestPerformancePing = function _onIPCBus_TestPerformancePing(ipcBusEvent, transaction) {
        _ipcBus.send('test-performance-pong', _uuid, transaction);
    }

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        // _ipcBus.send('test-performance-run', testParams, masterPeers);
        ++_transaction;
        let targets = [];
        function collectTarget(event, channel, curTransaction) {
            if (curTransaction === _transaction) {
                targets.push({ peer: event.sender, channel });
            }
        }
        _ipcBus.on('test-performance-pong', collectTarget);
        _ipcBus.send('test-performance-ping', _transaction);
        setTimeout(() => {
            _ipcBus.removeListener('test-performance-pong', collectTarget);
            targets = targets.filter(target => [IpcBusProcessType.Node, IpcBusProcessType.Renderer, IpcBusProcessType.Main]
                .includes(target.peer.type)).filter(onlyUnique);
            let masterTargets = [];
            [IpcBusProcessType.Node, IpcBusProcessType.Renderer, IpcBusProcessType.Main].forEach(type => {
                const index = targets.findIndex((target) => target.peer.type === type);
                if (index >= 0) {
                    masterTargets.push(targets[index]);
                    targets.splice(index, 1);
                }
            });
            masterTargets = masterTargets.filter(value => value);

            const combinations = pairwise(masterTargets);
            combinations.push(...pairwise(masterTargets.reverse()));
            combinations.push(...masterTargets.map(target => [target, target]));
            masterTargets.forEach(target => {
                const similarTarget = targets.find((curr) => curr.peer.type === target.peer.type);
                if (similarTarget) {
                    combinations.push([target, similarTarget]);
                }
            });
            combinations.forEach(combination => {
                let uuid = createUuid();
                uuid = uuid + uuidPattern.substring(0, uuidPattern.length - uuid.length);
                _testsPending.push({ uuid, testParams, combination });
            });

            this.loopTest();

        }, 2000);
    }

    this.loopTest = function() {
        if (_testsInProgress.size > 0) {
            return true;
        }
        const testResult = _testsPending.shift();
        if (testResult) {
            console.log(`testRun:${JSON.stringify(testResult, null, 4)}`);
            _testsInProgress.set(testResult.uuid, testResult);
            const testChannel = 'test-performance-' + testResult.uuid;
            _ipcBus.request(
                'test-performance-to-' + testResult.combination[1].channel,
                testTimeout,
                testResult.uuid,
                testChannel
            )
            .then(() => {
                _ipcBus.send(
                    'test-performance-from-' + testResult.combination[0].channel,
                    testResult.uuid,
                    testChannel,
                    testResult.testParams,
                );
            })
            .catch((err) => {});
            setTimeout(() => {
                if (_testsInProgress.get(testResult.uuid)) {
                    this.onTestFailed(testResult);
                }
            },
            testTimeout * 300);
            return true;
        }
        return false;
    }

    this.clear = function() {
        _testsPending = [];
        _testsInProgress = new Map();
        _testsSucceeded = [];
        _testsFailed = [];
    }

    this.onTestProgressCB = function(cb) {
        _testProgressCB = cb;
    }

    this.onTestFailed = function(testResult) {
        _testsFailed.push(testResult);
        var msgTestStart = testResult.start || {
            uuid: testResult.uuid,
            peer: testResult.combination[0].peer,
            timeStamp: 0
        };
        testResult.start = msgTestStart;
        var msgTestStop = testResult.stop || {
            uuid: testResult.uuid,
            timeStamp: msgTestStart.timeStamp - 1000,
            peer: testResult.combination[1].peer,
        };
        testResult.stop = msgTestStop;
        this.onTestProgress(testResult);
    }

    this.onTestProgress = function(testResult) {
        if (testResult.start && testResult.stop) {
            if (_testsInProgress.delete(testResult.uuid)) {
                _testsSucceeded.push(testResult);
                testResult.delay = testResult.stop.timeStamp - testResult.start.timeStamp;
                console.log(`testDone:${JSON.stringify(testResult, null, 4)}`);
                _testProgressCB && _testProgressCB(testResult, _testsSucceeded, _testsPending.length);
            }
        }
        if (!this.loopTest()) {
            // _ipcBus.removeAllListeners('test-performance-start');
            // _ipcBus.removeAllListeners('test-performance-stop');
        }
    }

    this.onIPCBus_CollectStart = function(ipcBusEvent, msgTestStart) {
        // console.log(`testStart:${JSON.stringify(msgTestStart, null, 4)}`);
        const testResult = _testsInProgress.get(msgTestStart.uuid);
        if (testResult) {
            testResult.start = msgTestStart;
            this.onTestProgress(testResult);
        }
        else {
            _testsInProgress.set(msgTestStart.uuid, { start: msgTestStart });
        }
    }

    this.onIPCBus_CollectStop = function(ipcBusEvent, msgTestStop) {
        // console.log(`testStop:${JSON.stringify(msgTestStop, null, 4)}`);
        const testResult = _testsInProgress.get(msgTestStop.uuid);
        if (testResult) {
            testResult.stop = msgTestStop;
            this.onTestProgress(testResult);
        }
        else {
            _testsInProgress.set(msgTestStop.uuid, { stop: msgTestStop });
        }
    }

    this.onIPCBus_TestPerformanceRun = function _onIPCBus_TestPerformanceRun(ipcBusEvent, uuid, channel, testParams) {
        var msgTestStart = {
            uuid: uuid,
            peer: _ipcBus.peer
        };

        var payload;
        if (testParams.typeArgs === 'string') {
            payload = [allocateString(uuid, testParams.bufferSize)];
        }
        else if (testParams.typeArgs === 'object') {
            payload = [{ 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize),
                str: 'string',
                num: 2.22,
                bool: true
            }];
        }
        else if (testParams.typeArgs === 'buffer') {
            payload = [Buffer.alloc(Number(testParams.bufferSize))];
            payload[0].write(uuid, 0, uuid.length, 'utf8');
        }
        else if (testParams.typeArgs === 'args') {
            payload = [];
            payload.push({ 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize / 2)
            });
            payload.push('string');
            payload.push(2.22);
            payload.push(true);
            payload.push(Buffer.alloc(Number(testParams.bufferSize / 2)));
        }

        msgTestStart.timeStamp = Date.now();
        _ipcBus.send('test-performance-start', msgTestStart);
        if (testParams.typeCommand == 'Request') {
            _ipcBus.request.apply(_ipcBus, [2000, channel, ...payload])
            .then((ipcRequestResponse) => this.onIPCBus_TestPerformance(ipcRequestResponse.event, ipcRequestResponse.payload[0])) 
            .catch();
        }
        else {
            _ipcBus.send(channel, ...payload);
        }
    }

    this.onIPCBus_TestPerformance = function _onIPCBus_TestPerformance(ipcBusEvent, uuid, channel) {
        const catchTest = function(ipcBusEvent, ...args) {
            var msgTestStop = { 
                uuid: uuid,
                timeStamp: Date.now(),
                peer: _ipcBus.peer
            };
            _ipcBus.send('test-performance-stop', msgTestStop);
            if (ipcBusEvent.request) {
                ipcBusEvent.request.resolve();
            }
        };
        _ipcBus.once(channel, catchTest);
        setTimeout(() => {
            _ipcBus.removeListener(channel, catchTest);
        }, testTimeout);
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve();
        }
    }

    this.onIPCBus_TestPerformanceTrace = function _onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace) {
        _ipcBusModule.ActivateIpcBusTrace(activateTrace);
    }

    function allocateString(seed, num) {
        num = Number(num) / 100;
        var result = seed;
        var str ='0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
        while (true) {
            if (num & 1) { // (1)
                result += str;
            }
            num >>>= 1; // (2)
            if (num <= 0) break;
            str += str;
        }
        return result;
    }

    function createUuid() {
        // return Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
        return _uuidFactory();
    }

    const _ipcBusModule = require('electron-common-ipc');
    const _uuidFactory = require('nanoid').nanoid;
    var _ipcBus = _ipcBusModule.CreateIpcBusClient();
    var _uuid = createUuid();
    var _testProgressCB;
    var _transaction = 0;
    this.clear();
}

module.exports = PerfTests;