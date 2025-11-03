class IssuingAuthority {
    static name = 'IssuingAuthority';
    static collection = 'issuing_authorities';
    static IsStandardModel = true;

    static getSchema() {
        return {
            // Dùng để tuân thủ Phụ lục IV
            code: { type: String, unique: true, required: true }, // Vd: "02"
            name: { type: String, required: true } // Vd: "Phòng Quản lý Xuất nhập khẩu khu vực TP. Hồ Chí Minh"
        };
    }
}

module.exports = IssuingAuthority;