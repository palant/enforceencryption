/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

"use strict";

let {spawn} = require("child_process");
let path = require("path");
let url = require("url");

let del = require("del");
let gulp = require("gulp");
let eslint = require("gulp-eslint");
let zip = require("gulp-zip");

let utils = require("./gulp-utils");

let sources = ["manifest.json", "data/**/*", "_locales/**/*", "icon*.png", "LICENSE.TXT"];

function getBuildFileName(extension)
{
  let filename = utils.readArg("--outfile=");
  if (!filename)
  {
    let manifest = require("./manifest.json");
    filename = "enforceencryption-" + manifest.version + "." + extension;
  }

  let dir = "";
  if (path.isAbsolute(filename))
  {
    dir = path.dirname(filename);
    filename = path.basename(filename);
  }

  return [dir, filename];
}

function buildZIP(filename, manifestModifier)
{
  return gulp.src(sources, {cwdbase: true})
      .pipe(utils.jsonModify("manifest.json", manifestModifier))
      .pipe(zip(filename));
}

gulp.task("default", ["xpi"], function()
{
});

gulp.task("eslint-node", function()
{
  return gulp.src(["*.js"])
             .pipe(eslint({envs: ["node", "es6"]}))
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

gulp.task("eslint-data", function()
{
  return gulp.src(["data/**/*.js"])
             .pipe(eslint({envs: ["browser", "es6"]}))
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

gulp.task("validate", ["eslint-node", "eslint-data"], function()
{
});

gulp.task("xpi", ["validate"], function()
{
  let manifest = require("./manifest.json");
  let [dir, filename] = getBuildFileName("xpi");
  return buildZIP(filename, function(manifestData)
  {
    delete manifestData.minimum_chrome_version;
  }).pipe(gulp.dest(dir));
});

gulp.task("crx", ["validate"], function()
{
  let [dir, filename] = getBuildFileName("zip");
  let result = buildZIP(filename, function(manifestData)
  {
    delete manifestData.applications;
  });
  let keyFile = utils.readArg("--private-key=");
  if (keyFile)
    result = result.pipe(utils.signCRX(keyFile));
  return result.pipe(gulp.dest(dir));
});

gulp.task("clean", function()
{
  return del(["*.xpi", "*.zip", "*.crx"]);
});
