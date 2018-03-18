#!/bin/sh

electron-packager . --icon icons/icon.icns --overwrite --out dist
rm -Rf /Applications/Edge.app
cp -R ./dist/Edge-darwin-x64/Edge.app /Applications/
