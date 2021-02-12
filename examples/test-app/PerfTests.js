const testTimeout = 2000;

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
    const _ipcBusModule = require('electron-common-ipc');
    const _uuidFactory = require('uuid');
    var _ipcBus = _ipcBusModule.IpcBusClient.Create();
    var _uuid = createUuid();
    var _testsPending = [];
    var _testsInProgress = new Map();
    var _testsResults = [];
    var _testProgressCB;

    this.connect = function(peerName, view) {
        _ipcBus.connect(busPath, { peerName })
            .then(() => {
                if (!view) {
                    _ipcBus.on('test-performance-ping', (ipcBusEvent, ...args) => this.onIPCBus_TestPerformancePing(ipcBusEvent));
                    _ipcBus.on('test-performance-trace', (ipcBusEvent, ...args) => this.onIPCBus_TestPerformanceTrace(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-from-' + _uuid, (ipcBusEvent, ...args) => this.onIPCBus_TestPerformanceRun(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-to-'+ _uuid, (ipcBusEvent, ...args) => this.onIPCBus_TestPerformance(ipcBusEvent, ...args));
                }
                else {
                    _ipcBus.on('test-performance-start', (ipcBusEvent, ...args) => this.onIPCBus_CollectStart(ipcBusEvent, ...args));
                    _ipcBus.on('test-performance-stop', (ipcBusEvent, ...args) => this.onIPCBus_CollectStop(ipcBusEvent, ...args));
                }
            });
    }

    this.onIPCBus_TestPerformancePing = function _onIPCBus_TestPerformancePing(ipcBusEvent) {
        _ipcBus.send('test-performance-pong', _uuid);
    }

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        // _ipcBus.send('test-performance-run', testParams, masterPeers);
        let targets = [];
        function collectTarget(event, channel) {
            targets.push({ peer: event.sender, channel });
        }
        _ipcBus.on('test-performance-pong', collectTarget);
        _ipcBus.send('test-performance-ping');
        setTimeout(() => {
            _ipcBus.removeListener('test-performance-pong', collectTarget);
            targets = targets.filter(target => ['node', 'renderer', 'main'].includes(target.peer.process.type)).filter(onlyUnique);
            let masterTargets = [];
            ['node', 'renderer', 'main'].forEach(type => {
                const index = targets.findIndex((target) => target.peer.process.type === type);
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
                const similarTarget = targets.find((curr) => curr.peer.process.type === target.peer.process.type);
                if (similarTarget) {
                    combinations.push([target, similarTarget]);
                }
            });
            combinations.forEach(combination => {
                let uuid = createUuid();
                uuid = uuid + uuidPattern.substring(0, uuidPattern.length - uuid.length);
                _testsPending.push({ uuid, testParams, combination });
            });

            if (_testsInProgress.size === 0) {
                this.loopTest();
            }

        }, 2000);
    }

    this.loopTest = function() {
        const test = _testsPending.shift();
        if (test) {
            console.log(`testRun:${JSON.stringify(test, null, 4)}`);
            _testsInProgress.set(test.uuid, test);
            const testChannel = 'test-performance-' + test.uuid;
            _ipcBus.request(
                'test-performance-to-' + test.combination[1].channel,
                testTimeout,
                test.uuid,
                testChannel
            )
            .then(() => {
                _ipcBus.send(
                    'test-performance-from-' + test.combination[0].channel,
                    test.uuid,
                    testChannel,
                    test.testParams,
                );
            })
            .catch(() => {
                this.loopTest();
            });
            return true;
        }
        return false;
    }

    this.clear = function() {
        _testsPending = [];
        _testsInProgress.clear();
        _testsResults = [];
    }

    this.onTestProgressCB = function(cb) {
        _testProgressCB = cb;
    }

    this.onTestProgress = function(testResult) {
        if (testResult.start && testResult.stop) {
            if (_testsInProgress.delete(testResult.uuid)) {
                _testsResults.push(testResult);
                testResult.delay = testResult.stop.timeStamp - testResult.start.timeStamp;
                console.log(`testDone:${JSON.stringify(testResult, null, 4)}`);
                _testProgressCB && _testProgressCB(testResult, _testsResults, _testsPending.length);
                if (!this.loopTest()) {
                    // _ipcBus.removeAllListeners('test-performance-start');
                    // _ipcBus.removeAllListeners('test-performance-stop');
                }
            }
        }
    }

    this.onIPCBus_CollectStart = function(ipcBusEvent, msgTestStart) {
        console.log(`testStart:${JSON.stringify(msgTestStart, null, 4)}`);
        const test = _testsInProgress.get(msgTestStart.uuid);
        if (test) {
            test.start = msgTestStart;
            this.onTestProgress(test);
        }
        else {
            _testsInProgress.set(msgTestStart.uuid, { start: msgTestStart });
        }
    }

    this.onIPCBus_CollectStop = function(ipcBusEvent, msgTestStop) {
        console.log(`testStop:${JSON.stringify(msgTestStop, null, 4)}`);
        const test = _testsInProgress.get(msgTestStop.uuid);
        if (test) {
            test.stop = msgTestStop;
            this.onTestProgress(test);
        }
        else {
            _testsInProgress.set(msgTestStop.uuid, { stop: msgTestStop });
        }
    }

    this.onIPCBus_TestPerformanceRun = function _onIPCBus_TestPerformanceRun(ipcBusEvent, uuid, channel, testParams) {
        var msgTestStart = {
            uuid: uuid,
            peer: _ipcBus.peer,
            test: testParams
        };

        var msgContent;
        if (testParams.typeArgs === 'string') {
            msgContent = [allocateString(uuid, testParams.bufferSize)];
        }
        else if (testParams.typeArgs === 'object') {
            msgContent = [{ 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize),
                str: 'string',
                num: 2.22,
                bool: true
            }];
        }
        else if (testParams.typeArgs === 'buffer') {
            msgContent = [Buffer.alloc(Number(testParams.bufferSize))];
            msgContent[0].write(uuid, 0, uuid.length, 'utf8');
        }
        else if (testParams.typeArgs === 'args') {
            msgContent = [];
            msgContent.push({ 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize / 2)
            });
            msgContent.push('string');
            msgContent.push(2.22);
            msgContent.push(true);
            msgContent.push(Buffer.alloc(Number(testParams.bufferSize / 2)));
        }

        msgTestStart.timeStamp = Date.now();
        _ipcBus.send('test-performance-start', msgTestStart);
        if (testParams.typeCommand == 'Request') {
            _ipcBus.request.apply(_ipcBus, [2000, channel, ...msgContent])
            .then((ipcRequestResponse) => this.onIPCBus_TestPerformance(ipcRequestResponse.event, ipcRequestResponse.payload[0])) 
            .catch();
        }
        else {
            _ipcBus.send(channel, ...msgContent);
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
        return _uuidFactory.v1();
    }
}

module.exports = PerfTests;