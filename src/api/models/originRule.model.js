const { Schema } = require('mongoose');

class OriginRule {
    static name = 'OriginRule';
    static collection = 'origin_rules';
    static IsStandardModel = true;

    static getSchema() {
        return {
            circularId: { type: Schema.Types.ObjectId, ref: 'CircularBundle', required: true },
            chapterId: { type: Schema.Types.ObjectId, ref: 'HsChapter', required: true },
            formType: { type: String, required: true, trim: true },
            hsGroup: { type: String, required: true, trim: true },
            hsSubgroup: { type: String, required: true, trim: true },
            description: { type: String, default: '' },
            criteria: { type: String, required: true, trim: true },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        };
    }
}

module.exports = OriginRule;