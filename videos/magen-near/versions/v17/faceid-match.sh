#!/bin/zsh
# Sends "Matching Face" to the front Simulator window (the film device) through the Simulator menu.
osascript -e 'tell application "Simulator" to activate' -e 'delay 0.3' -e 'tell application "System Events" to tell process "Simulator" to click menu item "Matching Face" of menu 1 of menu item "Face ID" of menu "Features" of menu bar item "Features" of menu bar 1' >/dev/null
