class OriginRule {
    static name = 'OriginRule';
    static collection = 'origin_rules';
    static IsStandardModel = true;

    static getSchema() {
        // Đây là collection "trừ hao" - Biến Phụ lục I thành dữ liệu
        return {
            formType: { type: String, required: true, enum: ["FORM_E", "FORM_B"] },
            hsCode: { type: String, required: true }, // Mã HS 6 số của thành phẩm
            description: String,
            criteria: [{ // Mảng các tiêu chí được chấp nhận (hỗ trợ logic "HOẶC")
                _id: false,
                type: {
                    type: String,
                    required: true,
                    enum: ["WO", "CC", "CTH", "CTSH", "RVC", "PSR", "SP"]
                },
                rvcPercent: { type: Number, default: 0 } // Vd: 40 (nếu type là RVC)
            }],
            effectiveDate: { type: Date, default: Date.now },
            sourceCircular: String // Vd: "Thông tư 12/2019/TT-BCT"
        };
    }
}

module.exports = OriginRule;