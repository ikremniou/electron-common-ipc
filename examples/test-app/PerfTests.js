function pairwise(list) {
    if (list.length < 2) { return []; }
    var first = list[0],
        rest  = list.slice(1),
        pairs = rest.map(function (x) { return [first, x]; });
    return pairs.concat(pairwise(rest));
  }

var PerfTests = function _PerfTests(type, busPath) {
    const _ipcBusModule = require('electron-common-ipc');
    const _uuidFactory = require('uuid');
    var _ipcBus = _ipcBusModule.IpcBusClient.Create();
    var _type = type;
    var _uuid = createUuid();
    var _testsPending = [];

    this.connect = function(peerName) {
        _ipcBus.connect(busPath, { peerName })
            .then(() => {
                _ipcBus.on('test-performance-ping', (ipcBusEvent) => this.onIPCBus_TestPerformancePing(ipcBusEvent));
                _ipcBus.on('test-performance-trace', (ipcBusEvent, activateTrace) => this.onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace));
                _ipcBus.on('test-performance-from-' + _uuid, (ipcBusEvent, testParams, masterPeer) => this.onIPCBus_TestPerformanceRun(ipcBusEvent, testParams, channel));
                _ipcBus.on('test-performance-to-'+ _uuid, (ipcBusEvent, msgContent) => this.onIPCBus_TestPerformance(ipcBusEvent, msgContent));
                // _ipcBus.on('test-performance', (ipcBusEvent, msgContent) => this.onIPCBus_TestPerformance(ipcBusEvent, msgContent));
            });
    }

    this.onIPCBus_TestPerformancePing = function _onIPCBus_TestPerformancePing(ipcBusEvent) {
        _ipcBus.send('test-performance-pong', _uuid);
    }

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        // _ipcBus.send('test-performance-run', testParams, masterPeers);
        let targets = [];
        _ipcBus.on('test-performance-pong', (event, channel) => {
            targets.push({ peer: event.sender, channel });
        });
        _ipcBus.send('test-performance-ping');
        setTimeout(() => {
            _ipcBus.removeAllListeners('test-performance-pong');
            targets = targets.filter(target => ['node', 'renderer', 'main'].includes(target.peer.process.type));
            let masterTargets = [];
            ['node', 'renderer', 'main'].forEach(type => {
                const index = targets.findIndex((target) => target.peer.process.type === type);
                masterTargets.push(targets[index]);
                targets.splice(index, 1);
            });
            masterTargets = masterTargets.filter(value => value);

            const combinations = pairwise(masterTargets);
            combinations.push(...pairwise(masterTargets.reverse()));
            masterTargets.forEach(target => {
                const similarTarget = targets.find((curr) => curr.peer.process.type === target.peer.process.type);
                if (similarTarget) {
                    combinations.push([target, similarTarget]);
                }
            });
            combinations.forEach(combination => {
                _testsPending.push({ testParams, uuid: createUuid(), combination });
            });

            if (_ipcBus.listenerCount('test-performance-start') === 0) {
                _ipcBus.on('test-performance-start', (ipcBusEvent) => this.onIPCBus_CollectStart(ipcBusEvent, msgTestStart));
                _ipcBus.on('test-performance-stop', (ipcBusEvent) => this.onIPCBus_CollectStop(ipcBusEvent, msgTestStop));
                this.loopTest();
            }

        }, 2000);
    }

    this.loopTest = function() {
        const test = _testsPending.shift();
        if (test) {
            _ipcBus.send('test-performance-from-' + test.combination[0].channel, test.uuid, test.testParams, test.combination[1].channel);
            return true;
        }
        return false;
    }

    this.onIPCBus_CollectStart = function(ipcBusEvent, msgTestStart) {

    }

    this.onIPCBus_CollectStop = function(ipcBusEvent, msgTestStop) {
        if (!this.loopTest()) {
            _ipcBus.removeAllListeners('test-performance-start');
            _ipcBus.removeAllListeners('test-performance-stop');
    }
    }

    this.onIPCBus_TestPerformanceRun = function _onIPCBus_TestPerformanceRun(ipcBusEvent, testParams, channel) {
        var uuid = createUuid();
        var uuidPattern = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        uuid = uuid + uuidPattern.substring(0, 30 - uuid.length)

        var msgTestStart = { 
            uuid: uuid,
            test: testParams,
            type: _type, 
            peer: _ipcBus.peer
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

    this.onIPCBus_TestPerformance = function _onIPCBus_TestPerformance(ipcBusEvent, msgContent) {
        var dateNow = Date.now();
        var uuid;
        switch (typeof msgContent) {
            case 'object':
                if (Array.isArray(msgContent)) {
                    uuid = msgContent[0].uuid;
                }
                else if (Buffer.isBuffer(msgContent)) {
                    uuid = msgContent.toString('utf8', 0, 30);
                }
                // in renderer process, Buffer = Uint8Array
                else if (msgContent instanceof Uint8Array) {
                    var buf = Buffer.from(msgContent.buffer)
                    uuid = buf.toString('utf8', 0, 30);
                }
                else {
                    uuid = msgContent.uuid;
                }
                break;
            case 'string':
                uuid = msgContent.substring(0, 30);
                break;
            case 'number':
                break;
            case 'boolean':
                break;
        }
            
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve([msgContent]);
        }
        else if (uuid) {
            var msgTestStop = { 
                uuid: uuid,
                type: _type, 
                timeStamp: dateNow,
                peer: _ipcBus.peer
            };
            _ipcBus.send('test-performance-stop', msgTestStop);
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