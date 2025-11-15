class Company {
  static name = "Company";
  static collection = "companies";
  static IsStandardModel = true;

  static getSchema() {
    return {
      name: { type: String, required: true },
      taxCode: { type: String, unique: true, sparse: true },
      address: String,
      type: {
        type: String,
        required: true,
        enum: ["EXPORTER", "SUPPLIER"],
      },
      createdAt: { type: Date, default: Date.now },
    };
  }
}

module.exports = Company;
