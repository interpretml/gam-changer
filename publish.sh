#!/bin/bash

npm run build
cp -r ./public/*png ./gh-page
cp -r ./public/data ./gh-page
cp -r ./public/img ./gh-page
cp -r ./public/video ./gh-page
cp -r ./public/build ./gh-page
cp -r ./public/global.css ./gh-page

cp -r lite/output ./gh-page/notebook

npx gh-pages -m "Deploy $(git log '--format=format:%H' master -1)" -d ./gh-page