//=============================================================================
// ParallelBgs.js
// ----------------------------------------------------------------------------
// Copyright (c) 2016 Triacontane
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php
// ----------------------------------------------------------------------------
// Version
// 1.0.0 2016/11/12 初版
// ----------------------------------------------------------------------------
// [Blog]   : http://triacontane.blogspot.jp/
// [Twitter]: https://twitter.com/triacontane/
// [GitHub] : https://github.com/triacontane/
//=============================================================================

/*:
 * @plugindesc ParallelBgsPlugin
 * @author triacontane
 *
 * @help 複数のBGSを並行して演奏できます。プラグインコマンドからBGSの演奏ラインを
 * 変更するとBGS関連の処理対象が、指定したラインに切り替わります。
 * 演奏ラインのデフォルトは[1]です。
 *
 * ラインの数に制限はありませんが、あまりに大量のBGSを
 * 同時に演奏しようとすると動作に影響がでる恐れがあります。
 *
 * また、マップで指定するオート演奏のBGSはラインが[1]で固定になります。
 *
 * プラグインコマンド詳細
 *  イベントコマンド「プラグインコマンド」から実行。
 *  （パラメータの間は半角スペースで区切る）
 *
 * PB_BGSライン変更 2              # BGSの演奏ラインを[2]に変更します。
 * PB_BGS_CHANGE_LINE 2            # 同上
 * PB_BGS_全停止                   # 全ての演奏中のBGSを停止します。
 * PB_BGS_ALL_STOP                 # 同上
 * PB_BGS_SE演奏時フェードアウト 1 # SE演奏時にBGSを自動フェードアウトします
 * PB_BGS_FADEOUT_FOR_SE 1         # 同上(※1)
 * PB_BGS_フェードアウト時間 3     # 自動フェードアウトに掛かる時間を指定します。
 * PB_BGS_FADEOUT_TIME 3           # 同上
 *
 * ※1 フェードアウト方法を指定できます。
 *  0 : フェードアウトせずに通常通りSEを演奏します。
 *  1 : SE演奏と同時にフェードアウトを開始します。
 *  2 : フェードアウトが完了してからSE演奏します。
 *
 * 2の設定はSEの演奏を実行してから、実際に演奏されるまで時間が掛かります。
 * 使いどころにご注意ください。
 *
 * This plugin is released under the MIT License.
 */
/*:ja
 * @plugindesc BGS並行演奏プラグイン
 * @author トリアコンタン
 *
 * @help 複数のBGSを並行して演奏できます。プラグインコマンドからBGSの演奏ラインを
 * 変更するとBGS関連の処理対象が、指定したラインに切り替わります。
 * 演奏ラインのデフォルトは[1]です。
 *
 * ラインの数に制限はありませんが、あまりに大量のBGSを
 * 同時に演奏しようとすると動作に影響がでる恐れがあります。
 *
 * また、マップで指定するオート演奏のBGSはラインが[1]で固定になります。
 *
 * プラグインコマンド詳細
 *  イベントコマンド「プラグインコマンド」から実行。
 *  （パラメータの間は半角スペースで区切る）
 *
 * PB_BGSライン変更 2              # BGSの演奏ラインを[2]に変更します。
 * PB_BGS_CHANGE_LINE 2            # 同上
 * PB_BGS_全停止                   # 全ての演奏中のBGSを停止します。
 * PB_BGS_ALL_STOP                 # 同上
 * PB_BGS_SE演奏時フェードアウト 1 # SE演奏時にBGSを自動フェードアウトします
 * PB_BGS_FADEOUT_FOR_SE 1         # 同上(※1)
 * PB_BGS_フェードアウト時間 3     # 自動フェードアウトに掛かる時間を指定します。
 * PB_BGS_FADEOUT_TIME 3           # 同上
 *
 * ※1 フェードアウト方法を指定できます。
 *  0 : フェードアウトせずに通常通りSEを演奏します。
 *  1 : SE演奏と同時にフェードアウトを開始します。
 *  2 : フェードアウトが完了してからSE演奏します。
 *
 * 2の設定はSEの演奏を実行してから、実際に演奏されるまで時間が掛かります。
 * 使いどころにご注意ください。
 *
 * 利用規約：
 *  作者に無断で改変、再配布が可能で、利用形態（商用、18禁利用等）
 *  についても制限はありません。
 *  このプラグインはもうあなたのものです。
 */

(function() {
    'use strict';
    var metaTagPrefix = 'PB_';

    var getCommandName = function(command) {
        return (command || '').toUpperCase();
    };

    var getArgNumber = function(arg, min, max) {
        if (arguments.length < 2) min = -Infinity;
        if (arguments.length < 3) max = Infinity;
        return (parseInt(convertEscapeCharacters(arg), 10) || 0).clamp(min, max);
    };

    var convertEscapeCharacters = function(text) {
        if (text == null) text = '';
        var windowLayer = SceneManager._scene._windowLayer;
        return windowLayer ? windowLayer.children[0].convertEscapeCharacters(text) : text;
    };

    //=============================================================================
    // Game_Interpreter
    //  プラグインコマンドを追加定義します。
    //=============================================================================
    var _Game_Interpreter_pluginCommand      = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.apply(this, arguments);
        if (!command.match(new RegExp('^' + metaTagPrefix))) return;
        try {
            this.pluginCommandParallelBgs(command.replace(metaTagPrefix, ''), args);
        } catch (e) {
            if ($gameTemp.isPlaytest() && Utils.isNwjs()) {
                var window = require('nw.gui').Window.get();
                if (!window.isDevToolsOpen()) {
                    var devTool = window.showDevTools();
                    devTool.moveTo(0, 0);
                    devTool.resizeTo(window.screenX + window.outerWidth, window.screenY + window.outerHeight);
                    window.focus();
                }
            }
            console.log('プラグインコマンドの実行中にエラーが発生しました。');
            console.log('- コマンド名 　: ' + command);
            console.log('- コマンド引数 : ' + args);
            console.log('- エラー原因   : ' + e.stack || e.toString());
        }
    };

    Game_Interpreter.prototype.pluginCommandParallelBgs = function(command, args) {
        switch (getCommandName(command)) {
            case 'BGS_CHANGE_LINE' :
            case 'BGS_ライン変更' :
                $gameSystem.setBgsLine(getArgNumber(args[0], 1));
                break;
            case 'BGS_ALL_STOP' :
            case 'BGS_全停止' :
                AudioManager.stopAllBgs();
                break;
            case 'BGS_FADEOUT_FOR_SE' :
            case 'BGS_SE演奏時フェードアウト' :
                $gameSystem.setBgsFadeForSe(getArgNumber(args[0], 0));
                break;
            case 'BGS_FADEOUT_TIME' :
            case 'BGS_フェードアウト時間' :
                $gameSystem.setBgsFadeTime(getArgNumber(args[0], 1));
                break;
        }
    };

    //=============================================================================
    // Game_System
    //  BGS演奏ラインを変更します。
    //=============================================================================
    var _Game_System_initialize      = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.apply(this, arguments);
        this.initBgsMember();
    };

    Game_System.prototype.initBgsMember = function() {
        this.setBgsLine(this.getBgsLine());
        this.setBgsFadeForSe(this.getBgsFadeForSe());
        this.setBgsFadeTime(this.getBgsFadeTime());
    };

    Game_System.prototype.getBgsLine = function() {
        return this._bgsLine || 1;
    };

    Game_System.prototype.setBgsLine = function(value) {
        this._bgsLine = value;
        AudioManager.setBgsLineIndex(value);
    };

    Game_System.prototype.getBgsFadeForSe = function() {
        return this._bgsFadeForPlayingSe || 0;
    };

    Game_System.prototype.setBgsFadeForSe = function(value) {
        this._bgsFadeForPlayingSe = value;
        AudioManager.setBgsFadeForSe(value);
    };

    Game_System.prototype.getBgsFadeTime = function() {
        return this._bgsFadeTime || 1;
    };

    Game_System.prototype.setBgsFadeTime = function(value) {
        this._bgsFadeTime = value;
        AudioManager.setBgsFadeTime(value);
    };

    var _Game_System_onAfterLoad      = Game_System.prototype.onAfterLoad;
    Game_System.prototype.onAfterLoad = function() {
        _Game_System_onAfterLoad.apply(this, arguments);
        this.initBgsMember();
    };

    var _Game_Map_autoplay      = Game_Map.prototype.autoplay;
    Game_Map.prototype.autoplay = function() {
        AudioManager.multiLineDisable = true;
        _Game_Map_autoplay.apply(this, arguments);
        AudioManager.multiLineDisable = false;
    };

    //=============================================================================
    // AudioManager
    //  複数のBGS演奏ラインを管理します。
    //=============================================================================
    AudioManager.multiLineDisable = false;
    AudioManager._bgsLineIndex    = 1;
    AudioManager._bgsFadeForSe    = 0;
    AudioManager._bgsFadeTime     = 1;
    AudioManager._allBgsBuffer    = [];
    AudioManager._currentAllBgs   = [];
    AudioManager._delaySeStack    = [];
    AudioManager._allStop         = false;
    AudioManager._stopAllBgs      = true;
    AudioManager._bgsFading       = false;
    AudioManager._bgsFadeCounter  = 0;

    Object.defineProperty(AudioManager, '_bgsBuffer', {
        get: function() {
            return this._allBgsBuffer[this.getBgsLineIndex()];
        },
        set: function(value) {
            this._allBgsBuffer[this.getBgsLineIndex()] = value;
        }
    });

    Object.defineProperty(AudioManager, '_currentBgs', {
        get: function() {
            return this._currentAllBgs[this.getBgsLineIndex()];
        },
        set: function(value) {
            this._currentAllBgs[this.getBgsLineIndex()] = value;
        }
    });

    AudioManager.getBgsLineIndex = function() {
        return this.multiLineDisable ? 1 : this._bgsLineIndex;
    };

    AudioManager.setBgsLineIndex = function(index) {
        this._bgsLineIndex = index;
    };

    AudioManager.setBgsFadeForSe = function(value) {
        this._bgsFadeForSe = value;
    };

    AudioManager.setBgsFadeTime = function(value) {
        this._bgsFadeTime = value;
    };

    var _AudioManager_playBgs = AudioManager.playBgs;
    AudioManager.playBgs      = function(bgs, pos) {
        this._stopAllBgs = false;
        if (Array.isArray(bgs)) {
            this.playAllBgs();
        } else {
            _AudioManager_playBgs.apply(this, arguments);
        }
        this._stopAllBgs = true;
    };

    AudioManager.playAllBgs = function(bgsArray, pos) {
        this.stopAllBgs();
        var prevIndex      = this._bgsLineIndex;
        this._bgsLineIndex = 1;
        bgsArray.forEach(function(bgs) {
            _AudioManager_playBgs.call(this, bgs, pos);
            this._bgsLineIndex++;
        }, this);
        this._bgsLineIndex = prevIndex;
    };

    var _AudioManager_saveBgs = AudioManager.saveBgs;
    AudioManager.saveBgs      = function() {
        var bgsArray = [];
        this.iterateAllBgs(function() {
            bgsArray.push(_AudioManager_saveBgs.apply(this, arguments));
        }.bind(this));
        return bgsArray.length > 1 ? bgsArray : bgsArray[0];
    };

    var _AudioManager_stopBgs = AudioManager.stopBgs;
    AudioManager.stopBgs      = function() {
        if (!this._stopAllBgs) {
            _AudioManager_stopBgs.apply(this, arguments);
        }
    };

    AudioManager.stopAllBgs = function() {
        this.iterateAllBgs(function() {
            _AudioManager_stopBgs.apply(this, arguments);
        }.bind(this));
    };

    AudioManager.iterateAllBgs = function(callBack) {
        var prevIndex = this._bgsLineIndex;
        Object.keys(this._allBgsBuffer).forEach(function(index) {
            this._bgsLineIndex = index;
            callBack(this._bgsBuffer);
        }, this);
        this._bgsLineIndex = prevIndex;
    };

    var _AudioManager_playSe = AudioManager.playSe;
    AudioManager.playSe      = function(se) {
        if (this.isNeedFadeOut()) {
            this.fadeOutBgsForSe();
        }
        if (this._bgsFadeForSe === 2 && this._currentBgs && this._bgsFadeCounter > 0) {
            this._delaySeStack.push(se);
        } else {
            _AudioManager_playSe.apply(this, arguments);
        }
    };

    AudioManager.updateBgsFade = function() {
        if (this.isNeedFadeIn()) {
            this.fadeInBgsForSe();
        }
        if (this._bgsFadeCounter > 0) {
            this._bgsFadeCounter--;
            if (this._bgsFadeCounter === 0) {
                this.playDelayedSe();
            }
        }
    };

    AudioManager.fadeOutBgsForSe = function() {
        var prevCurrentBgs = this._currentBgs;
        this.fadeOutBgs(this._bgsFadeTime);
        this._currentBgs     = prevCurrentBgs;
        this._bgsFading      = true;
        this._bgsFadeCounter = this._bgsFadeTime * 60;
    };

    AudioManager.isNeedFadeOut = function() {
        return !this._bgsFading && this._bgsFadeForSe !== 0;
    };

    AudioManager.fadeInBgsForSe = function() {
        this.fadeInBgs(this._bgsFadeTime);
        this._bgsFading      = false;
        this._bgsFadeCounter = 0;
    };

    AudioManager.isNeedFadeIn = function() {
        return this._bgsFading && !this.isPlayingAnySe() && this._bgsFadeCounter === 0;
    };

    AudioManager.playDelayedSe = function() {
        while (this._delaySeStack.length > 0) {
            _AudioManager_playSe.call(this, this._delaySeStack.pop());
        }
    };

    AudioManager.isPlayingAnySe = function() {
        return this._seBuffers.some(function(audio) {
            return audio.isExist();
        });
    };

    //=============================================================================
    // WebAudio
    //  演奏が要求済みかどうかを返します。
    //=============================================================================
    WebAudio.prototype.isExist = function() {
        return !!this._autoPlay;
    };

    //=============================================================================
    // SceneManager
    //  AudioManagerの更新処理を呼び出します。
    //=============================================================================
    var _SceneManager_updateScene = SceneManager.updateScene;
    SceneManager.updateScene      = function() {
        _SceneManager_updateScene.apply(this, arguments);
        if (this._scene) {
            AudioManager.updateBgsFade();
        }
    };
})();
