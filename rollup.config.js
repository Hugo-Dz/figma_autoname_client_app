import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import node from "@rollup/plugin-node-resolve";
import dotenv from 'rollup-plugin-dotenv';

// Svelte related
import svelte from "rollup-plugin-svelte";
import autoPreprocess from "svelte-preprocess";

// Minifier
import { terser } from "rollup-plugin-terser";

// Post CSS
import postcss from "rollup-plugin-postcss";

// Inline to single html
import htmlBundle from "rollup-plugin-html-bundle";

// Typescript
import typescript from "rollup-plugin-typescript";

//Image
import image from "@rollup/plugin-image";

//Rollup json plugin to use JSON packages
import json from '@rollup/plugin-json';

const production = !process.env.ROLLUP_WATCH;

export default [
  // MAIN.JS
  // The main JS for the UI, will built and then injected
  // into the template as inline JS for compatibility reasons
  {
    input: "src/main.js",
    output: {
      format: "umd",
      name: "ui",
      file: "public/bundle.js",
    },
    plugins: [
      // Dot env
      dotenv(),
      // Svelte plugin
      svelte({
        // enable run-time checks when not in production
        dev: !production,
        preprocess: autoPreprocess(),
        onwarn: (warning, handler) => {
          const { code, frame } = warning;
          if (code === "css-unused-selector" && frame.includes("shape")) return;

          handler(warning);
        },
      }),

      //Node
      node(),

      //dd

      // Handle external dependencies and prepare
      // the terrain for svelte later on
      resolve({
        browser: true,
        dedupe: (importee) =>
          importee === "svelte" || importee.startsWith("svelte/"),
        extensions: [".svelte", ".mjs", ".js", ".json", ".node", ".ts"],
      }),

      // Typescript
      typescript({ sourceMap: !production }),

      // Post CSS config
      postcss({
        extensions: [".css"],
      }),

      //Image plugin
      image(),

      //JSON plugin
      json(),

      //Common JS plugin to import stuff that don't have default export
      commonjs({
        transformMixedEsModules: true
      }),

      // This inject the bundled version of main.js
      // into the the template
      htmlBundle({
        template: "src/template.html",
        target: "public/index.html",
        inline: true,
      }),

      // If dev mode, serve and livereload
      !production && serve(),
      !production && livereload("public"),

      // If prod mode, we minify
      production && terser(),
    ],
    watch: {
      clearScreen: true,
    },
  },

  // CODE.JS
  // The part that communicate with Figma directly
  // Communicate with main.js via event send/binding
  {
    input: "src/code.ts",
    output: {
      file: "public/code.js",
      format: "iife",
      name: "code",
    },
    plugins: [
      dotenv(),
      typescript(),
      resolve(),
      commonjs({ transformMixedEsModules: true }),
      production && terser(),
    ],
  },
];

function serve() {
  let started = false;

  return {
    writeBundle() {
      if (!started) {
        started = true;

        require("child_process").spawn("npm", ["run", "start", "--", "--dev"], {
          stdio: ["ignore", "inherit", "inherit"],
          shell: true,
        });
      }
    },
  };
}
