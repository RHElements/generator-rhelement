module.exports = function factory({
  elementName,
  className,
  precompile = []
} = {}) {
  const fs = require("fs");
  const path = require("path");

  const pfelementPackage = require("../package.json");
  const gulp = require("gulp");
  const rename = require("gulp-rename");
  const replace = require("gulp-replace");
  const stripCssComments = require("strip-css-comments");
  const trim = require("trim");
  const decomment = require("decomment");
  const sass = require("node-sass");
  const shell = require("gulp-shell");
  const banner = require("gulp-banner");
  const browserSync = require("browser-sync").create();
  const compression = require("compression");

  gulp.task("merge", () => {
    return gulp
      .src(`./src/${elementName}.js`)
      .pipe(
        replace(
          /extends\s+PFElement\s+{/g,
          (classStatement, character, jsFile) => {
            // extract the templateUrl and styleUrl with regex.  Would prefer to do
            // this by require'ing rh-something.js and asking it directly, but without
            // node.js support for ES modules, we're stuck with this.
            const oneLineFile = jsFile
              .slice(character)
              .split("\n")
              .join(" ");
            const [
              ,
              templateUrl
            ] = /get\s+templateUrl\([^)]*\)\s*{\s*return\s+"([^"]+)"/.exec(
              oneLineFile
            );

            let html = fs
              .readFileSync(path.join("./src", templateUrl))
              .toString()
              .trim();

            html = decomment(html);

            const [
              ,
              styleUrl
            ] = /get\s+styleUrl\([^)]*\)\s*{\s*return\s+"([^"]+)"/.exec(
              oneLineFile
            );

            const styleFilePath = path.join("./src", styleUrl);

            let cssResult = sass.renderSync({
              file: styleFilePath
            }).css;

            cssResult = stripCssComments(cssResult).trim();

            return `${classStatement}
  get html() {
    return \`
<style>
${cssResult}
</style>
${html}\`;
  }
`;
          }
        )
      )
      .pipe(
        banner(
          `/*\n${fs
            .readFileSync("LICENSE.txt", "utf8")
            .split("\n")
            .map(line => ` * ${line}\n`)
            .join("")}*/\n\n`
        )
      )
      .pipe(gulp.dest("./"));
  });

  gulp.task("compile", () => {
    return gulp
      .src(`./${elementName}.js`)
      .pipe(
        replace(
          /^(import .*?)(['"]\.\.\/(?!\.\.\/).*)\.js(['"];)$/gm,
          "$1$2.umd$3"
        )
      )
      .pipe(
        rename({
          suffix: ".umd"
        })
      )
      .pipe(gulp.dest("./"));
  });

  gulp.task("watch", () => {
    return gulp.watch("./src/*", gulp.series("build"));
  });

  gulp.task("browser-sync", () => {
    browserSync.init({
      server: {
        baseDir: "./",
        middleware: [compression()]
      },
      startPath: "/demo/"
    });

    gulp
      .watch([
        `./${pfelementPackage.pfelement.elementName}.*`,
        "./demo/index.html"
      ])
      .on("change", browserSync.reload);
  });

  gulp.task("bundle", shell.task("./node_modules/.bin/rollup -c"));

  const buildTasks = ["merge", ...precompile, "compile", "bundle"];

  gulp.task("build", gulp.series(...buildTasks));

  gulp.task("default", gulp.series("build"));

  gulp.task(
    "dev",
    gulp.series("build", gulp.parallel("browser-sync", "watch"))
  );

  return gulp;
};
