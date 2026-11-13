#!/bin/zsh
# Standalone Magen for Apple-silicon iOS Simulators (Release, embedded JS bundle, ad-hoc signed so the keychain works
# for expo-secure-store). Pods, DerivedData and the zip stay inside packages/mobile on the external SSD.
# One Xcode build at a time on this Mac: grokbot/orchestration/.xcode-lock.
set -euo pipefail
export LANG=en_US.UTF-8
HERE=${0:A:h}; MOBILE=${HERE:h}
LOCK="$MOBILE/../../../../orchestration/.xcode-lock"
OUT="$MOBILE/build-out"
FREE=$(df -g / | tail -1 | awk '{print $4}')
(( FREE >= 5 )) || { echo "BLOCKED: only ${FREE} GB free on the system disk (need 5)"; exit 1; }
until mkdir "$LOCK" 2>/dev/null; do echo "waiting for the Xcode lock ($(cat "$LOCK/owner" 2>/dev/null))"; sleep 30; done
echo "magen $(date -u +%FT%TZ)" > "$LOCK/owner"; trap 'rm -rf "$LOCK"' EXIT
cd "$MOBILE"
[[ -d ios ]] || npx expo prebuild --platform ios --no-install
(cd ios && pod install | tail -2)
(cd ios && xcodebuild -workspace Magen.xcworkspace -scheme Magen -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= | tail -3)
APP="$MOBILE/ios/build/Build/Products/Release-iphonesimulator/Magen.app"
mkdir -p "$OUT"; rm -f "$OUT/Magen-NEAR-iOS-Simulator.zip"
(cd "${APP:h}" && ditto -c -k --norsrc --keepParent Magen.app "$OUT/Magen-NEAR-iOS-Simulator.zip")
SHA=$(shasum -a 256 "$OUT/Magen-NEAR-iOS-Simulator.zip" | cut -d' ' -f1)
echo "$SHA  Magen-NEAR-iOS-Simulator.zip" > "$OUT/Magen-NEAR-iOS-Simulator.zip.sha256"
echo "Magen-NEAR-iOS-Simulator.zip sha256 $SHA"
echo "Install: unzip, then xcrun simctl install booted Magen.app && xcrun simctl launch booted xyz.magen.near"
