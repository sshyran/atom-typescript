"use strict";
const lodash_1 = require("lodash");
const tsUtil_1 = require("./utils/tsUtil");
class ErrorPusher {
    constructor() {
        this.errors = new Map();
        this.pushErrors = lodash_1.debounce(() => {
            const errors = [];
            for (const fileErrors of this.errors.values()) {
                for (const [filePath, diagnostics] of fileErrors) {
                    for (const diagnostic of diagnostics) {
                        errors.push({
                            type: "Error",
                            text: diagnostic.text,
                            filePath: filePath,
                            range: diagnostic.start ? tsUtil_1.locationsToRange(diagnostic.start, diagnostic.end) : undefined
                        });
                    }
                }
            }
            if (this.linter) {
                this.linter.setMessages(errors);
            }
        }, 100);
    }
    setErrors(prefix, filePath, errors) {
        let prefixed = this.errors.get(prefix);
        if (!prefixed) {
            prefixed = new Map();
            this.errors.set(prefix, prefixed);
        }
        prefixed.set(filePath, errors);
        this.pushErrors();
    }
    clear() {
        if (this.linter) {
            this.linter.deleteMessages();
        }
    }
    setLinter(linter) {
        this.linter = linter;
        this.pushErrors();
    }
}
exports.ErrorPusher = ErrorPusher;