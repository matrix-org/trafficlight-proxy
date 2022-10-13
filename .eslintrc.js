module.exports = {
    plugins: [
        "matrix-org",
    ],
    env: {
        browser: true,
        node: true,
    },
    globals: {
        LANGUAGES_FILE: "readonly",
    },
    rules: {
        // Things we do that break the ideal style
        "no-constant-condition": "off",
        "prefer-promise-reject-errors": "off",
        "no-async-promise-executor": "off",
        "quotes": "off",
        "no-extra-boolean-cast": "off",
    },
    overrides: [
        {
            files: [
                "src/**/*.{ts,tsx}",
                "test/**/*.{ts,tsx}",
                "cypress/**/*.ts",
                "scripts/**/*.ts",
            ],
            extends: [
                "plugin:matrix-org/typescript",
            ],
            rules: {
                // Things we do that break the ideal style
                "prefer-promise-reject-errors": "off",
                "quotes": "off",
                "no-extra-boolean-cast": "off",
                // Permit while(true) constructs
                // for (;;;) is permitted and is equivalent to while(true) but less readable
		"no-constant-condition": [ "error", { "checkLoops": false } ],
                // Remove Babel things manually due to override limitations
                "@babel/no-invalid-this": ["off"],

                // We're okay being explicit at the moment
                "@typescript-eslint/no-empty-interface": "off",
                // We disable this while we're transitioning
                "@typescript-eslint/no-explicit-any": "off",
                // We'd rather not do this but we do
                "@typescript-eslint/ban-ts-comment": "off",
                // We're okay with assertion errors when we ask for them
                "@typescript-eslint/no-non-null-assertion": "off",

                // The non-TypeScript rule produces false positives
                "func-call-spacing": "off",
                "@typescript-eslint/func-call-spacing": ["error"],
            },
        },
    ],
};

function buildRestrictedPropertiesOptions(properties, message) {
    return properties.map(prop => {
        let [object, property] = prop.split(".");
        if (object === "*") {
            object = undefined;
        }
        return {
            object,
            property,
            message,
        };
    });
}
