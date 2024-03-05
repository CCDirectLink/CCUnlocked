#!/bin/sh
BASE_NAME="$(jq '.id' ccmod.json | sed 's/^"//;s/"$//')"
NAME="${BASE_NAME}-$(jq '.version' ccmod.json | sed 's/^"//;s/"$//').ccmod"
rm -rf "$BASE_NAME"*
npm install
npm run build
mkdir -p pack
cp -r assets lang nvdaplugin icon LICENSE plugin.js ./pack
cd ./pack
for file in $(find . -iname '*.json') $(find . -iname '*.json.patch') $(find . -iname '*.json.patch.cond'); do
    jq '.' ../$file -c > $file
done
cp ../ccmod.json .
rm -rf icon/icon240.png icon/icon.kra icon/icon.png~
zip -r "../$NAME" .
cd ..
rm -rf pack
