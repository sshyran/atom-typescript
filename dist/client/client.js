"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var child_process_1 = require("child_process");
var events_1 = require("events");
var stream_1 = require("stream");
var fs = require("fs");
var path = require("path");
var resolve = require("resolve");
var byline = require("byline");
var TypescriptServiceClient = (function (_super) {
    __extends(TypescriptServiceClient, _super);
    function TypescriptServiceClient(tsServerPath) {
        var _this = _super.call(this) || this;
        _this.callbacks = {};
        _this.seq = 0;
        _this.onMessage = function (res) {
            if (isResponse(res)) {
                var callback = _this.callbacks[res.request_seq];
                if (callback) {
                    console.log("received response in", Date.now() - callback.started, "ms");
                    delete _this.callbacks[res.request_seq];
                    if (res.success) {
                        callback.resolve(res);
                    }
                    else {
                        callback.reject(new Error(res.message));
                    }
                }
            }
            else if (isEvent(res)) {
                console.log("received event", res);
                _this.emit(res.event, res.body);
            }
        };
        _this.tsServerPath = tsServerPath;
        _this.serverPromise = _this.startServer();
        return _this;
    }
    TypescriptServiceClient.prototype.execute = function (command, args, expectResponse) {
        var _this = this;
        return this.serverPromise.then(function (cp) {
            return _this.sendRequest(cp, command, args, expectResponse);
        }).catch(function (err) {
            console.log("command", command, "failed due to", err);
            throw err;
        });
    };
    TypescriptServiceClient.prototype.sendRequest = function (cp, command, args, expectResponse) {
        var _this = this;
        var req = {
            seq: this.seq++,
            command: command,
            arguments: args
        };
        var resultPromise = undefined;
        if (expectResponse) {
            resultPromise = new Promise(function (resolve, reject) {
                _this.callbacks[req.seq] = { resolve: resolve, reject: reject, started: Date.now() };
            });
        }
        cp.stdin.write(JSON.stringify(req) + "\n");
        return resultPromise;
    };
    TypescriptServiceClient.prototype.startServer = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            console.log("starting", _this.tsServerPath);
            var cp = child_process_1.spawn(_this.tsServerPath, []);
            cp.once("error", function (err) {
                console.log("tsserver starting failed with", err);
                reject(err);
            });
            cp.once("exit", function (code) {
                console.log("tsserver failed to start with code", code);
                reject({ code: code });
            });
            messageStream(cp.stdout).on("data", _this.onMessage);
            _this.sendRequest(cp, "ping", null, true).then(function (res) { return resolve(cp); }, function (err) { return resolve(cp); });
        });
    };
    return TypescriptServiceClient;
}(events_1.EventEmitter));
exports.TypescriptServiceClient = TypescriptServiceClient;
function isEvent(res) {
    return res.type === "event";
}
function isResponse(res) {
    return res.type === "response";
}
function findTSServer(basedir) {
    var tsPath = resolve.sync("typescript", { basedir: basedir });
    var tsServerPath = path.resolve(path.dirname(tsPath), "..", "bin", "tsserver");
    fs.statSync(tsServerPath);
    return tsServerPath;
}
exports.findTSServer = findTSServer;
function messageStream(input) {
    return input.pipe(byline()).pipe(new MessageStream());
}
var MessageStream = (function (_super) {
    __extends(MessageStream, _super);
    function MessageStream() {
        var _this = _super.call(this, { objectMode: true }) || this;
        _this.lineCount = 1;
        return _this;
    }
    MessageStream.prototype._transform = function (line, encoding, callback) {
        if (this.lineCount % 2 === 0) {
            this.push(JSON.parse(line));
        }
        this.lineCount += 1;
        callback(null);
    };
    return MessageStream;
}(stream_1.Transform));