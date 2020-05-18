const presets = [
    [
        "@babel/env",
        {
            targets: {
                edge: "17",
                firefox: "60",
                chrome: "67",
                safari: "9",

            },
            useBuiltIns: "usage",
        },
    ],
];


module.exports = { presets };
