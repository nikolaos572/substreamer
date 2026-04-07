package com.doublesymmetry.trackplayer.utils

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.facebook.react.bridge.UiThreadUtil

object AppForegroundTracker {
    private var activityCount = 0

    val foregrounded: Boolean
        get() = activityCount > 0

    val backgrounded: Boolean
        get() = activityCount <= 0

    fun start() {
        UiThreadUtil.runOnUiThread {
            // ProcessLifecycleOwner.get() can throw NoClassDefFoundError on stripped
            // OEM ROMs where androidx.lifecycle.process was over-shrunk by the
            // Play Store delivery layer. Falling back to "always backgrounded" is
            // safer than crashing the host activity at module init.
            try {
                ProcessLifecycleOwner.get().lifecycle.addObserver(Observer)
            } catch (t: Throwable) {
                android.util.Log.w(
                    "AppForegroundTracker",
                    "Failed to register lifecycle observer: ${t.message}",
                    t
                )
            }
        }
    }

    object Observer : DefaultLifecycleObserver {

        override fun onResume(owner: LifecycleOwner) {
            super.onResume(owner)
            activityCount++
        }

        override fun onPause(owner: LifecycleOwner) {
            super.onPause(owner)
            activityCount--
        }
    }
}
