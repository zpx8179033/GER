/**
 * @author  zdongh2016
 * @fileoverview  Peep
 * @date 2017/02/16
 */

import utils from './utils';

let proxy = ( supperclass ) => class extends supperclass {
    constructor( options ) {
        super( options );
        this.consoleList = {};
        window.onload = () => {
            this.proxy();
        };
    }
    proxy() {
        if ( this.config.proxyAll ) {
            this.proxyJquery().proxyModule().proxyTimer().proxyConsole();
        }
    }
    proxyConsole() {
        [ 'log', 'debug', 'info', 'warn', 'error' ].forEach( ( type, index ) => {
            window.console[ type ] = this.reportConsole( window.console[ type ], type, index );
        } );
        return this;
    }
    // 劫持原生js
    proxyTimer() {
        window.setTimeout = utils.catTimeout( setTimeout );
        window.setInterval = utils.catTimeout( setInterval );
        return this;
    }
    // 劫持jquery
    proxyJquery( $ ) {
        let _$ = $ || window.$;

        if ( !_$ || !_$.event ) {
            return this;
        }

        let _add, _remove;
        if ( _$.zepto ) {
            _add = _$.fn.on, _remove = _$.fn.off;

            _$.fn.on = utils.makeArgsTry( _add );
            _$.fn.off = function () {
                let args = [];
                utils.toArray( arguments ).forEach( v => {
                    utils.isFunction( v ) && v.tryWrap && ( v = v.tryWrap );
                    args.push( v );
                } );
                return _remove.apply( this, args );
            };

        } else if ( $.fn.jquery ) {
            _add = _$.event.add, _remove = _$.event.remove;

            _$.event.add = utils.makeArgsTry( _add );
            _$.event.remove = () => {
                let args = [];
                utils.toArray( arguments ).forEach( v => {
                    utils.typeDecide( v, 'Function' ) && v.tryWrap && ( v = v.tryWrap );
                    args.push( v );
                } );
                return _remove.apply( this, args );
            };
        }

        let _ajax = _$.ajax;

        if ( _ajax ) {
            _$.ajax = ( url, setting ) => {
                if ( !setting ) {
                    setting = url;
                    url = undefined;
                }
                utils.makeObjTry( setting );
                if ( url ) return _ajax.call( _$, url, setting );
                return _ajax.call( _$, setting );
            };
        }
        return this;
    }
    reportConsole( func, type, level ) {
        return () => {
            this.on( 'beforeReport', () => {
                //启用console，强制merge
                this.config.mergeReport = true;
            } );
            let msg = utils.toArray( arguments ).join( ',' );
            let typeList = this.consoleList[ type ];
            typeList = typeList || [];
            typeList.push(
                Object.assign( utils.getSystemParams(), {
                    msg: msg,
                    level: level
                } )
            );
            if ( typeList.length > 10 ) {
                this.errorQueue = this.errorQueue.concat( typeList );
                this.send( true, () => {
                    typeList = [];
                } );
            }
            return func.apply( this, arguments );
        };
    }
    // 劫持seajs
    proxyModules() {
        var _require = window.require,
            _define = window.define;
        if ( _define && _define.amd && _require ) {
            window.require = utils.catArgs( _require );
            Object.assign( window.require, _require );
            window.define = utils.catArgs( _define );
            Object.assign( window.define, _define );
        }

        if ( window.seajs && _define ) {
            window.define = function () {
                var arg, args = [];
                utils.toArray( arguments ).forEach( ( v, i ) => {
                    if ( utils.isFunction( v ) ) {
                        v = utils.cat( v );
                        v.toString = ( function ( orgArg ) {
                            return function () {
                                return orgArg.toString();
                            };
                        }( arguments[ i ] ) );
                    }
                    args.push( arg );
                } );
                return _define.apply( this, args );

            };

            window.seajs.use = utils.catArgs( window.seajs.use );

            Object.assign( window.define, _define );
        }
        return this;

    }

    // 劫持自定义方法
    proxyCustom() {
        this.config.proxyCustom.forEach( ( v ) => {
            if ( utils.isFunction( v ) ) {
                return function () {
                    utils.toArray( arguments ).forEach( ( f ) => {
                        if ( utils.isFunction( f ) ) {
                            utils.cat( f );
                        } else {
                            utils.makeObjTry( f );
                        }
                    } );
                };
            } else {
                this.error( {
                    msg: '自定义方法类型必须为function',
                    level: 4
                } );
            }
        } );
        return this;
    }
};
export default proxy;