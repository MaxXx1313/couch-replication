"use strict";
var util = require('util');
var singleLog = require('single-line-log').stdout;
var REPORT_TIMEOUT = 1000;
var ANIMATION_DELAY = 150;
/**
 * Console long operation mode
 */
var LopConsole = (function () {
    /**
     *
     */
    function LopConsole() {
        this._status = 'Please wait...';
        this.shouldReportLOP = true;
        this.states = ['-', '\\', '/'];
        this.stateLength = this.states.length;
        this.idx = 0; // state index
        // this.idx = 0;
        //
        // let console_log_original = console.log;
        // console.log = lop_console_log;
    }
    LopConsole.prototype.log = function (a) {
        this._clear();
        console.log.apply(console, arguments);
        this._print();
    };
    /**
     * Start Long Opration
     */
    LopConsole.prototype.startLOP = function () {
        var _this = this;
        var args = Array.prototype.slice.call(arguments);

        // console.log.apply(console, arguments);
        this.startTime = Date.now();
        this.endTime = null;
        this.reportTimer = setInterval(function () { _this.shouldReportLOP = true; }, REPORT_TIMEOUT);
        this._animationTimer = setInterval(function () {
            this.idx = (this.idx + 1) % this.stateLength;
            this._print();
        // this.reportTimer.unref();
        // this._animationTimer.unref();
        }.bind(this), ANIMATION_DELAY);
    };
    /**
     * Stop Long OPeration
     */
    LopConsole.prototype.stopLOP = function () {
        clearInterval(this._animationTimer);
        clearInterval(this.reportTimer);
        this.endTime = Date.now();
        singleLog('');
        // singleLog.clear();
    };
    /**
     * Get elapsed milliseconds
     * @return {number}
     */
    LopConsole.prototype.elapsedLOP = function () {
        return (this.endTime || Date.now()) - this.startTime;
    };
    /**
     * Update long operation progress
     */
    LopConsole.prototype.logLOP = function () {
        var args = Array.prototype.slice.call(arguments);

        // if (this.shouldReportLOP) {
        //     this.shouldReportLOP = false;
        //     this._status = util.format.apply(util, arguments);
        // }

            this._status = util.format.apply(util, arguments);
            this._print();
    };
    LopConsole.prototype._print = function () {
        singleLog(util.format('[%s] %s', this.states[this.idx], this._status)); // write text
    };
    LopConsole.prototype._clear = function () {
        singleLog(''); // clear
    };
    return LopConsole;
}());
module.exports = LopConsole;
