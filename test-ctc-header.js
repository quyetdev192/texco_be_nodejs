// Test script for CTC Header Extraction
const mongoose = require('mongoose');
const CTCHeaderExtractorService = require('./src/core/services/HeaderExtractor.service');

async function testCTCHeaderExtraction() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/texco_db');
    console.log('✅ MongoDB connected');

    // Test with existing lohangDraftId
    const lohangDraftId = '691493d8b854cee3bb910fe2';
    
    const extractor = new CTCHeaderExtractorService();
    const headerInfo = await extractor.extractHeaderInfo(lohangDraftId);
    
    console.log('✅ Header extraction result:');
    console.log(JSON.stringify(headerInfo, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

// Load environment variables
require('dotenv').config();

// Run test
testCTCHeaderExtraction();
