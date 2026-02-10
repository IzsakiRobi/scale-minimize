'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib'; 
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class SimpleScaleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = Main.wm._shouldAnimateActor;
        Main.wm._shouldAnimateActor = function(actor, types) {
            let stack = new Error().stack;
            if (stack && (stack.indexOf("_minimizeWindow") !== -1 || stack.indexOf("_unminimizeWindow") !== -1)) {
                return false; 
            }
            return Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor(actor, types);
        };

        Main.wm._shellwm.original_completed_minimize = Main.wm._shellwm.completed_minimize;
        Main.wm._shellwm.completed_minimize = function(actor) { return; };

        this._minimizeSignalId = global.window_manager.connect('minimize', (wm, actor) => {
            this._animateMinimize(actor);
        });

        this._unminimizeSignalId = global.window_manager.connect('unminimize', (wm, actor) => {
            this._animateUnminimize(actor);
        });
    }

    disable() {
        if (this._unminimizeIdleId) {
            GLib.source_remove(this._unminimizeIdleId);
            this._unminimizeIdleId = null;
        }

        this._settings = null;

        if (this._minimizeSignalId) {
            global.window_manager.disconnect(this._minimizeSignalId);
            this._minimizeSignalId = null;
        }
        if (this._unminimizeSignalId) {
            global.window_manager.disconnect(this._unminimizeSignalId);
            this._unminimizeSignalId = null;
        }

        if (Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor) {
            Main.wm._shouldAnimateActor = Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor;
            Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = null;
        }
        if (Main.wm._shellwm.original_completed_minimize) {
            Main.wm._shellwm.completed_minimize = Main.wm._shellwm.original_completed_minimize;
            Main.wm._shellwm.original_completed_minimize = null;
        }
        
        global.get_window_actors().forEach(actor => {
            this._resetActorState(actor);
        });
    }

    _resetActorState(actor) {
        actor.remove_all_transitions();
        actor.set_easing_duration(0);

        actor.scale_x = 1;
        actor.scale_y = 1;
        actor.translation_x = 0;
        actor.translation_y = 0;
        actor.set_pivot_point(0, 0); 
        
        actor.queue_relayout();

        actor.opacity = 255;
        
        if (actor.meta_window && !actor.meta_window.minimized) {
            actor.show();
        }
    }

    _getTargetGeometry(actor) {
        let monitorIndex = actor.meta_window.get_monitor();
        let monitor = Main.layoutManager.monitors[monitorIndex];
        
        let targetX = monitor.x + (monitor.width / 2);
        let targetY = monitor.y + monitor.height + 50; 
        let targetScale = 0;

        return { x: targetX, y: targetY, scale: targetScale };
    }

    _getAnimationCurve(modeIndex) {
        switch (modeIndex) {
            case 0: return Clutter.AnimationMode.EASE_IN_EXPO; 
            case 1: return Clutter.AnimationMode.EASE_OUT_EXPO; 
            case 2: return Clutter.AnimationMode.LINEAR;
            default: return Clutter.AnimationMode.EASE_IN_EXPO;
        }
    }

    _animateMinimize(actor) {
        if (Main.overview.visible) {
            Main.wm._shellwm.original_completed_minimize(actor);
            return;
        }

        actor.remove_all_transitions();

        const duration = this._settings.get_int('duration');
        const finalOpacity = this._settings.get_int('final-opacity');
        const bounceScale = this._settings.get_double('bounce-scale');
        const bounceRatio = this._settings.get_double('bounce-ratio');
        const curveIndex = this._settings.get_int('animation-curve');

        let target = this._getTargetGeometry(actor);

        actor.set_pivot_point(0.5, 0.5);

        let transX = target.x - (actor.x + actor.width / 2);
        let transY = target.y - (actor.y + actor.height / 2);

        const selectedCurve = this._getAnimationCurve(curveIndex);

        if (bounceScale <= 1.001) { 
            actor.ease({
                scale_x: target.scale,
                scale_y: target.scale,
                translation_x: transX,
                translation_y: transY,
                opacity: finalOpacity,
                duration: duration,
                mode: selectedCurve,
                onComplete: () => {
                    actor.opacity = 0; 
                    actor.hide();      
                    this._resetActorState(actor);
                    Main.wm._shellwm.original_completed_minimize(actor);
                }
            });
        } else {
            actor.ease({
                scale_x: bounceScale,
                scale_y: bounceScale,
                duration: duration * bounceRatio,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    actor.ease({
                        scale_x: target.scale,
                        scale_y: target.scale,
                        translation_x: transX, 
                        translation_y: transY,
                        opacity: finalOpacity,
                        duration: duration * (1 - bounceRatio),
                        mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onComplete: () => {
                            actor.opacity = 0; 
                            actor.hide();      
                            this._resetActorState(actor);
                            Main.wm._shellwm.original_completed_minimize(actor);
                        }
                    });
                }
            });
        }
    }

    _animateUnminimize(actor) {
        actor.opacity = 0;
        actor.set_pivot_point(0.5, 0.5);

        if (this._unminimizeIdleId) GLib.source_remove(this._unminimizeIdleId);

        this._unminimizeIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._unminimizeIdleId = null;
            if (!actor || !actor.get_parent()) return GLib.SOURCE_REMOVE;

            if (Main.overview.visible) {
                this._resetActorState(actor);
                return GLib.SOURCE_REMOVE;
            }

            let startTarget = this._getTargetGeometry(actor);
            
            let startTransX = startTarget.x - (actor.x + actor.width / 2);
            let startTransY = startTarget.y - (actor.y + actor.height / 2);

            actor.translation_x = startTransX;
            actor.translation_y = startTransY;
            
            actor.scale_x = 0.1;
            actor.scale_y = 0.1;
            
            actor.show();
            actor.opacity = 255; 

            const duration = this._settings.get_int('duration');
            
            actor.ease({
                translation_x: 0,
                translation_y: 0,
                scale_x: 1,
                scale_y: 1,
                opacity: 255,
                duration: duration,
                mode: Clutter.AnimationMode.EASE_OUT_EXPO,
                onComplete: () => {
                    this._resetActorState(actor);
                }
            });
            
            return GLib.SOURCE_REMOVE;
        });
    }
}

