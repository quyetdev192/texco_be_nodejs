const { Schema } = require('mongoose');

class HsChapter {
    static name = 'HsChapter';
    static collection = 'hs_chapters';
    static IsStandardModel = true;

    static getSchema() {
        return {
            circularId: { type: Schema.Types.ObjectId, ref: 'CircularBundle', required: true },
            chapterNumber: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true },
            formType: { type: String, required: true, trim: true },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        };
    }
}

module.exports = HsChapter;
