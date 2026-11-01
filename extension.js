/* SPDX-License-Identifier: GPL-2.0-or-later */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class SimpleScaleExtension extends Extension {
    /* ----- Animation Lifecycle ----- */

    enable() {
        this._settings = this.getSettings();
        this._actors = new Map();
        this._unminimizeIdleIds = new Map();

        this._shouldAnimateActor = Main.wm._shouldAnimateActor;
        const originalShouldAnimate = this._shouldAnimateActor;
        Main.wm._shouldAnimateActor = function (actor, types) {
            const stack = new Error().stack;
            if (stack && (stack.includes('_minimizeWindow') || stack.includes('_unminimizeWindow'))) {
                return false;
            }
            return originalShouldAnimate.call(this, actor, types);
        };

        this._completedMinimize = Main.wm._shellwm.completed_minimize;
        Main.wm._shellwm.completed_minimize = () => {};

        this._minimizeSignalId = global.window_manager.connect('minimize', (wm, actor) => {
            this._animateMinimize(actor);
        });

        this._unminimizeSignalId = global.window_manager.connect('unminimize', (wm, actor) => {
            this._animateUnminimize(actor);
        });
    }

    disable() {
        global.window_manager.disconnect(this._minimizeSignalId);
        this._minimizeSignalId = null;
        global.window_manager.disconnect(this._unminimizeSignalId);
        this._unminimizeSignalId = null;

        for (const id of this._unminimizeIdleIds.values())
            GLib.source_remove(id);
        this._unminimizeIdleIds.clear();

        Main.wm._shouldAnimateActor = this._shouldAnimateActor;
        Main.wm._shellwm.completed_minimize = this._completedMinimize;
        for (const [actor, {minimizing}] of this._actors) {
            this._resetActorState(actor);
            if (minimizing)
                this._completedMinimize.call(Main.wm._shellwm, actor);
        }
        this._actors.clear();
        this._actors = null;
        this._unminimizeIdleIds = null;
        this._shouldAnimateActor = null;
        this._completedMinimize = null;
        this._settings = null;
    }

    /* ----- Actor State ----- */

    _trackActor(actor, minimizing) {
        this._resetActorState(actor);
        const destroyId = actor.connect('destroy', () => {
            const idleId = this._unminimizeIdleIds.get(actor);
            if (idleId)
                GLib.source_remove(idleId);
            this._unminimizeIdleIds.delete(actor);
            this._actors.delete(actor);
        });
        this._actors.set(actor, {minimizing, destroyId});
    }

    _resetActorState(actor) {
        const idleId = this._unminimizeIdleIds.get(actor);
        if (idleId)
            GLib.source_remove(idleId);
        this._unminimizeIdleIds.delete(actor);
        const record = this._actors.get(actor);
        if (record) {
            actor.disconnect(record.destroyId);
            this._actors.delete(actor);
        }
        actor.remove_all_transitions();

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
        const monitorIndex = actor.meta_window.get_monitor();
        const monitor = Main.layoutManager.monitors[monitorIndex] ?? Main.layoutManager.primaryMonitor;

        const targetX = monitor.x + (monitor.width / 2);
        const targetY = monitor.y + monitor.height + 50;
        const targetScale = 0;

        return {x: targetX, y: targetY, scale: targetScale};
    }

    _getAnimationCurve(modeIndex) {
        switch (modeIndex) {
            case 0: return Clutter.AnimationMode.EASE_IN_EXPO;
            case 1: return Clutter.AnimationMode.EASE_OUT_EXPO;
            case 2: return Clutter.AnimationMode.LINEAR;
            default: return Clutter.AnimationMode.EASE_IN_EXPO;
        }
    }

    /* ----- Minimize Animation ----- */

    _animateMinimize(actor) {
        if (Main.overview.visible) {
            this._resetActorState(actor);
            this._completedMinimize.call(Main.wm._shellwm, actor);
            return;
        }

        this._trackActor(actor, true);

        const duration = this._settings.get_int('duration');
        const finalOpacity = this._settings.get_int('final-opacity');
        const bounceScale = this._settings.get_double('bounce-scale');
        const bounceRatio = this._settings.get_double('bounce-ratio');
        const curveIndex = this._settings.get_int('animation-curve');

        const target = this._getTargetGeometry(actor);

        actor.set_pivot_point(0.5, 0.5);

        const transX = target.x - (actor.x + actor.width / 2);
        const transY = target.y - (actor.y + actor.height / 2);

        const selectedCurve = this._getAnimationCurve(curveIndex);

        if (bounceScale <= 1.001) {
            actor.ease({
                scale_x: target.scale,
                scale_y: target.scale,
                translation_x: transX,
                translation_y: transY,
                opacity: finalOpacity,
                duration,
                mode: selectedCurve,
                onComplete: () => {
                    actor.opacity = 0;
                    actor.hide();
                    this._resetActorState(actor);
                    this._completedMinimize.call(Main.wm._shellwm, actor);
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
                            this._completedMinimize.call(Main.wm._shellwm, actor);
                        }
                    });
                }
            });
        }
    }

    /* ----- Restore Animation ----- */

    _animateUnminimize(actor) {
        this._trackActor(actor, false);
        actor.opacity = 0;
        actor.set_pivot_point(0.5, 0.5);

        const idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._unminimizeIdleIds.delete(actor);
            if (!actor.get_parent()) {
                this._resetActorState(actor);
                return GLib.SOURCE_REMOVE;
            }

            if (Main.overview.visible) {
                this._resetActorState(actor);
                return GLib.SOURCE_REMOVE;
            }

            const startTarget = this._getTargetGeometry(actor);

            const startTransX = startTarget.x - (actor.x + actor.width / 2);
            const startTransY = startTarget.y - (actor.y + actor.height / 2);

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
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_EXPO,
                onComplete: () => {
                    this._resetActorState(actor);
                }
            });

            return GLib.SOURCE_REMOVE;
        });
        this._unminimizeIdleIds.set(actor, idleId);
    }
}
