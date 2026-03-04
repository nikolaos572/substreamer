package com.doublesymmetry.kotlinaudio.models

import android.os.Bundle
import androidx.media3.session.CommandButton
import androidx.media3.session.SessionCommand

enum class CustomCommandButton(
    val customAction: String,
    val capability: Capability,
    val commandButton: CommandButton,
) {
    JUMP_BACKWARD(
        customAction = "JUMP_BACKWARD",
        capability = Capability.JUMP_BACKWARD,
        commandButton = CommandButton.Builder(CommandButton.ICON_SKIP_BACK)
            .setDisplayName("Jump Backward")
            .setSessionCommand(SessionCommand("JUMP_BACKWARD", Bundle()))
            .build(),
    ),
    JUMP_FORWARD(
        customAction = "JUMP_FORWARD",
        capability = Capability.JUMP_FORWARD,
        commandButton = CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD)
            .setDisplayName("Jump Forward")
            .setSessionCommand(SessionCommand("JUMP_FORWARD", Bundle()))
            .build(),
    ),
    PREVIOUS(
        customAction = "PREVIOUS",
        capability = Capability.SKIP_TO_PREVIOUS,
        commandButton = CommandButton.Builder(CommandButton.ICON_PREVIOUS)
            .setDisplayName("Previous")
            .setSessionCommand(SessionCommand("PREVIOUS", Bundle()))
            .build(),
    ),
    NEXT(
        customAction = "NEXT",
        capability = Capability.SKIP_TO_NEXT,
        commandButton = CommandButton.Builder(CommandButton.ICON_NEXT)
            .setDisplayName("Next")
            .setSessionCommand(SessionCommand("NEXT", Bundle()))
            .build(),
    );
}
