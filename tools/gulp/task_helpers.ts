import * as child_process from 'child_process';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as gulpTs from 'gulp-typescript';
import * as path from 'path';

import { NPM_VENDOR_FILES, PROJECT_ROOT, DIST_ROOT, SASS_AUTOPREFIXER_OPTIONS } from './constants';

/** Those imports lack typings. */
const gulpClean = require('gulp-clean');
const gulpMerge = require('merge2');
const gulpRunSequence = require('run-sequence');
const gulpSass = require('gulp-sass');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpAutoprefixer = require('gulp-autoprefixer');
const resolveBin = require('resolve-bin');


/** If the string passed in is a glob, returns it, otherwise append '**\/*' to it. */
function _globify(maybeGlob: string, suffix = '**/*') {
  if (maybeGlob.indexOf('*') !== -1) {
    return maybeGlob;
  }
  try {
    const stat = fs.statSync(maybeGlob);
    if (stat.isFile()) {
      return maybeGlob;
    }
  } catch (e) { }
  return path.join(maybeGlob, suffix);
}


/** Create a TS Build Task, based on the options. */
export function tsBuildTask(tsConfigPath: string, tsConfigName = 'tsconfig.json') {
  let tsConfigDir = tsConfigPath;
  if (fs.existsSync(path.join(tsConfigDir, tsConfigName))) {
    // Append tsconfig.json
    tsConfigPath = path.join(tsConfigDir, tsConfigName);
  } else {
    tsConfigDir = path.dirname(tsConfigDir);
  }

  return () => {
    const tsConfig: any = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
    const dest: string = path.join(tsConfigDir, tsConfig['compilerOptions']['outDir']);

    const tsProject = gulpTs.createProject(tsConfigPath, {
      typescript: require('typescript')
    });

    const pipe = tsProject.src()
      .pipe(gulpSourcemaps.init())
      .pipe(tsProject());
    const dts = pipe.dts.pipe(gulp.dest(dest));

    return gulpMerge([
      dts,
      pipe
        .pipe(gulpSourcemaps.write('.'))
        .pipe(gulp.dest(dest))
    ]);
  };
}

export function ngcBuildTask(tsConfigPath: string, tsConfigName = 'tsconfig.json') {
  return execNodeTask('@angular/compiler-cli', 'ngc', ['-p', path.join(tsConfigPath, tsConfigName)], {
    failOnStderr: true,
  });
}

/** Create a SASS Build Task. */
export function sassBuildTask(dest: string, root: string, includePaths: string[]) {
  const sassOptions = { includePaths };

  return () => {
    return gulp.src(_globify(root, '**/*.scss'))
      .pipe(gulpSourcemaps.init())
      .pipe(gulpSass(sassOptions).on('error', gulpSass.logError))
      .pipe(gulpAutoprefixer(SASS_AUTOPREFIXER_OPTIONS))
      .pipe(gulpSourcemaps.write('.'))
      .pipe(gulp.dest(dest));
  };
}


/** Options that can be passed to execTask or execNodeTask. */
export interface ExecTaskOptions {
  // Whether to output to STDERR and STDOUT.
  silent?: boolean;
  // Whether STDOUT messages should be printed.
  silentStdout?: boolean;
  // If an error happens, this will replace the standard error.
  errMessage?: string;
  // Environment variables being passed to the child process.
  env?: any;
  // Whether the task should fail if the process writes to STDERR.
  failOnStderr?: boolean;
}

/** Create a task that executes a binary as if from the command line. */
export function execTask(binPath: string, args: string[], options: ExecTaskOptions = {}) {
  return (done: (err?: string) => void) => {
    const env = Object.assign({}, process.env, options.env);
    const childProcess = child_process.spawn(binPath, args, {env});
    const stderrData: string[] = [];

    if (!options.silentStdout && !options.silent) {
      childProcess.stdout.on('data', (data: string) => process.stdout.write(data));
    }

    if (!options.silent || options.failOnStderr) {
      childProcess.stderr.on('data', (data: string) => {
        options.failOnStderr ? stderrData.push(data) : process.stderr.write(data);
      });
    }

    childProcess.on('close', (code: number) => {
      if (options.failOnStderr && stderrData.length) {
        done(stderrData.join('\n'));
      } else {
        code != 0 ? done(options.errMessage || `Process failed with code ${code}`) : done();
      }
    });
  };
}

/**
 * Create a task that executes an NPM Bin, by resolving the binary path then executing it. These are
 * binaries that are normally in the `./node_modules/.bin` directory, but their name might differ
 * from the package. Examples are typescript, ngc and gulp itself.
 */
export function execNodeTask(packageName: string, executable: string | string[], args?: string[],
  options: ExecTaskOptions = {}) {
  if (!args) {
    args = <string[]>executable;
    executable = undefined;
  }

  return (done: (err: any) => void) => {
    resolveBin(packageName, { executable: executable }, (err: any, binPath: string) => {
      if (err) {
        done(err);
      } else {
        // Execute the node binary within a new child process using spawn.
        // The binary needs to be `node` because on Windows the shell cannot determine the correct
        // interpreter from the shebang.
        execTask('node', [binPath].concat(args), options)(done);
      }
    });
  };
}


/** Copy files from a glob to a destination. */
export function copyTask(srcGlobOrDir: string | string[], outRoot: string) {
  if (typeof srcGlobOrDir === 'string') {
    return () => gulp.src(_globify(srcGlobOrDir)).pipe(gulp.dest(outRoot));
  } else {
    return () => gulp.src(srcGlobOrDir.map(name => _globify(name))).pipe(gulp.dest(outRoot));
  }
}


/** Delete files. */
export function cleanTask(glob: string) {
  return () => gulp.src(glob, { read: false }).pipe(gulpClean(null));
}


/** Create a task that copies vendor files in the proper destination. */
export function vendorTask() {
  return () => gulpMerge(
    NPM_VENDOR_FILES.map((root: any) => {
      const glob = path.join(PROJECT_ROOT, 'node_modules', root, '**/*.+(js|js.map)');
      return gulp.src(glob).pipe(gulp.dest(path.join(DIST_ROOT, 'vendor', root)));
    }));
}

/** Create a task that's a sequence of other tasks. */
export function sequenceTask(...args: any[]) {
  return (done: any) => {
    gulpRunSequence(
      ...args,
      done
    );
  };
}
