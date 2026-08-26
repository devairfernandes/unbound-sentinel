import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        ignores: [
            "node_modules/**",
            "Sentinel_Landing/**",
            "frontend/**",
            "installer/**",
            "assets/**",
            "build_temp/**",
            "*.tar.gz",
            "*.iso",
            ".gemini/**",
            "scratch/**"
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                // Node.js globals
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
                exports: "readonly",
                // Browser/Fetch globals (used in some mixed scripts)
                fetch: "readonly",
                Headers: "readonly",
                AbortController: "readonly",
                URL: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^(e|err|req|res|code|signal|_.*|stdout|stderr|fs)$", "varsIgnorePattern": "^(e|err|req|res|code|signal|_.*|stdout|stderr|fs)$" }],
            "no-undef": "error",
            "no-empty": "warn"
        }
    }
];
