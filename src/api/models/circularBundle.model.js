class CircularBundle {
    static name = 'CircularBundle';
    static collection = 'circular_bundles';
    static IsStandardModel = true;

    static getSchema() {
        return {
            name: { type: String, required: true, trim: true },
            formType: { type: String, required: true, trim: true },
            files: [{
                type: {
                    type: String,
                    enum: ['THONG_TU', 'PHU_LUC_I', 'PHU_LUC_II', 'PHU_LUC_III', 'PHU_LUC_IV'],
                    required: true
                },
                url: { type: String, required: true, trim: true },
                filename: { type: String, required: true, trim: true }
            }],
            effectiveDate: { type: Date },
            notes: { type: String, default: '' },
            isActive: { type: Boolean, default: true },
            hasImportedPL1: { type: Boolean, default: false },
            isRemoved: { type: Boolean, default: false },
            uploadedBy: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        };
    }
}

module.exports = CircularBundle;
