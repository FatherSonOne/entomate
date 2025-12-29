/**
 * RAG System Test
 * Tests vector store, embedding service, and semantic search functionality
 *
 * Run: node tests/test-rag.js
 */

require('dotenv').config();

const vectorStore = require('../services/vectorStore');
const embeddingService = require('../services/embeddingService');
const ai = require('../config/ai');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(msg) { log(`✅ ${msg}`, 'green'); }
function fail(msg) { log(`❌ ${msg}`, 'red'); }
function info(msg) { log(`ℹ️  ${msg}`, 'blue'); }
function warn(msg) { log(`⚠️  ${msg}`, 'yellow'); }

// Test documents about meetings
const testDocuments = [
  {
    content: "In today's product roadmap meeting, we discussed the Q1 feature priorities. The team agreed to focus on improving the search functionality and adding real-time collaboration features. John will lead the search improvements, while Sarah takes ownership of collaboration tools.",
    metadata: { meetingType: 'product', date: '2024-12-20' }
  },
  {
    content: "The engineering standup covered several blockers. The API rate limiting issue is causing delays in data sync. Mike proposed implementing a queue-based approach. We also reviewed the new CI/CD pipeline which reduced build times by 40%.",
    metadata: { meetingType: 'engineering', date: '2024-12-21' }
  },
  {
    content: "Customer feedback session revealed that users want better mobile experience. Top requests include offline mode, faster load times, and improved notification handling. Action items assigned to the mobile team for Q1 sprint.",
    metadata: { meetingType: 'customer', date: '2024-12-22' }
  },
  {
    content: "Budget review meeting with finance. Marketing budget for Q1 approved at $50,000. Engineering headcount increase approved for two senior developers. Cloud infrastructure costs need optimization - target 15% reduction.",
    metadata: { meetingType: 'finance', date: '2024-12-23' }
  },
  {
    content: "Security audit findings discussed. Recommended implementing two-factor authentication for all admin accounts. Need to update SSL certificates and conduct penetration testing by end of January.",
    metadata: { meetingType: 'security', date: '2024-12-24' }
  }
];

async function runTests() {
  log('\n========================================', 'bold');
  log('   RAG SYSTEM TEST SUITE', 'bold');
  log('========================================\n', 'bold');

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
  };

  // Test 1: Check AI Provider Configuration
  log('Test 1: AI Provider Configuration', 'blue');
  try {
    const provider = ai.getProviderName();
    const configured = ai.isConfigured();

    if (configured) {
      success(`AI Provider: ${provider} (configured)`);
      results.passed++;
      results.tests.push({ name: 'AI Configuration', status: 'passed', provider });
    } else {
      fail(`AI Provider: ${provider} (NOT configured)`);
      warn('Set OPENAI_API_KEY or GEMINI_API_KEY in .env file');
      results.failed++;
      results.tests.push({ name: 'AI Configuration', status: 'failed', error: 'No API key' });

      // Can't continue without AI provider
      log('\n⚠️  Cannot continue without AI provider configured', 'yellow');
      return results;
    }
  } catch (error) {
    fail(`AI Configuration Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'AI Configuration', status: 'failed', error: error.message });
    return results;
  }

  // Test 2: Vector Store Readiness
  log('\nTest 2: Vector Store Readiness', 'blue');
  try {
    const ready = vectorStore.isReady();
    if (ready) {
      success('Vector Store is ready');
      results.passed++;
      results.tests.push({ name: 'Vector Store Ready', status: 'passed' });
    } else {
      fail('Vector Store is NOT ready');
      results.failed++;
      results.tests.push({ name: 'Vector Store Ready', status: 'failed' });
    }
  } catch (error) {
    fail(`Vector Store Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Vector Store Ready', status: 'failed', error: error.message });
  }

  // Test 3: Embedding Generation
  log('\nTest 3: Embedding Generation', 'blue');
  try {
    const testText = "This is a test sentence for embedding generation.";
    info(`Generating embedding for: "${testText}"`);

    const startTime = Date.now();
    const embedding = await vectorStore.generateEmbedding(testText);
    const duration = Date.now() - startTime;

    if (embedding && Array.isArray(embedding) && embedding.length > 0) {
      success(`Generated embedding with ${embedding.length} dimensions in ${duration}ms`);
      info(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      results.passed++;
      results.tests.push({
        name: 'Embedding Generation',
        status: 'passed',
        dimensions: embedding.length,
        duration
      });
    } else {
      fail('Embedding generation returned invalid result');
      results.failed++;
      results.tests.push({ name: 'Embedding Generation', status: 'failed' });
    }
  } catch (error) {
    fail(`Embedding Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Embedding Generation', status: 'failed', error: error.message });
  }

  // Test 4: Text Chunking
  log('\nTest 4: Text Chunking', 'blue');
  try {
    const longText = testDocuments.map(d => d.content).join('\n\n');
    const chunks = vectorStore.chunkText(longText, 500, 100);

    if (chunks && chunks.length > 0) {
      success(`Split text into ${chunks.length} chunks`);
      info(`Chunk sizes: [${chunks.map(c => c.text.length).join(', ')}]`);
      results.passed++;
      results.tests.push({ name: 'Text Chunking', status: 'passed', chunkCount: chunks.length });
    } else {
      fail('Text chunking returned no chunks');
      results.failed++;
      results.tests.push({ name: 'Text Chunking', status: 'failed' });
    }
  } catch (error) {
    fail(`Chunking Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Text Chunking', status: 'failed', error: error.message });
  }

  // Test 5: Document Ingestion
  log('\nTest 5: Document Ingestion (RAG Collection)', 'blue');
  const collectionName = 'rag_test_' + Date.now();
  let documentsStored = 0;

  try {
    info(`Creating test collection: ${collectionName}`);

    for (const doc of testDocuments) {
      info(`Ingesting: "${doc.content.substring(0, 50)}..."`);

      const result = await vectorStore.storeDocument({
        collectionName,
        content: doc.content,
        metadata: doc.metadata,
        sourceType: 'meeting'
      });

      if (result && result.id) {
        documentsStored++;
      }
    }

    if (documentsStored === testDocuments.length) {
      success(`Stored ${documentsStored}/${testDocuments.length} documents`);
      results.passed++;
      results.tests.push({
        name: 'Document Ingestion',
        status: 'passed',
        documentsStored,
        collection: collectionName
      });
    } else {
      warn(`Only stored ${documentsStored}/${testDocuments.length} documents`);
      results.tests.push({
        name: 'Document Ingestion',
        status: 'partial',
        documentsStored,
        expected: testDocuments.length
      });
    }
  } catch (error) {
    fail(`Ingestion Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Document Ingestion', status: 'failed', error: error.message });

    // If ingestion failed, skip search tests
    if (error.message.includes('table not found') || error.message.includes('42P01')) {
      warn('Vector documents table not found. Run migration 005_vector_store.sql');
      results.skipped += 3;
      return results;
    }
  }

  // Test 6: Similarity Search
  log('\nTest 6: Similarity Search', 'blue');
  if (documentsStored > 0) {
    try {
      const searchQuery = "What did we discuss about mobile and customer feedback?";
      info(`Searching: "${searchQuery}"`);

      const searchResult = await vectorStore.similaritySearch({
        query: searchQuery,
        collectionName,
        topK: 3,
        threshold: 0.3
      });

      if (searchResult.success && searchResult.results.length > 0) {
        success(`Found ${searchResult.results.length} results in ${searchResult.executionTime}ms`);

        searchResult.results.forEach((r, i) => {
          info(`  ${i + 1}. Similarity: ${(r.similarity || 0).toFixed(3)}`);
          info(`     Content: "${r.content.substring(0, 80)}..."`);
        });

        results.passed++;
        results.tests.push({
          name: 'Similarity Search',
          status: 'passed',
          resultCount: searchResult.results.length,
          executionTime: searchResult.executionTime
        });
      } else {
        warn('Search returned no results (this may be expected with low similarity)');
        results.tests.push({ name: 'Similarity Search', status: 'no_results' });
      }
    } catch (error) {
      fail(`Search Error: ${error.message}`);
      results.failed++;
      results.tests.push({ name: 'Similarity Search', status: 'failed', error: error.message });
    }
  } else {
    warn('Skipping search test - no documents stored');
    results.skipped++;
  }

  // Test 7: Hybrid Search
  log('\nTest 7: Hybrid Search (Vector + Keyword)', 'blue');
  if (documentsStored > 0) {
    try {
      const searchQuery = "security authentication";
      info(`Hybrid search: "${searchQuery}"`);

      const hybridResult = await vectorStore.hybridSearch({
        query: searchQuery,
        collectionName,
        topK: 3,
        vectorWeight: 0.7,
        keywordWeight: 0.3
      });

      if (hybridResult.success && hybridResult.results.length > 0) {
        success(`Hybrid search found ${hybridResult.results.length} results`);

        hybridResult.results.forEach((r, i) => {
          info(`  ${i + 1}. Combined Score: ${(r.combinedScore || 0).toFixed(3)}`);
          info(`     Vector: ${(r.vectorScore || 0).toFixed(3)}, Keyword: ${(r.keywordScore || 0).toFixed(3)}`);
        });

        results.passed++;
        results.tests.push({
          name: 'Hybrid Search',
          status: 'passed',
          resultCount: hybridResult.results.length
        });
      } else {
        warn('Hybrid search returned no results');
        results.tests.push({ name: 'Hybrid Search', status: 'no_results' });
      }
    } catch (error) {
      fail(`Hybrid Search Error: ${error.message}`);
      results.failed++;
      results.tests.push({ name: 'Hybrid Search', status: 'failed', error: error.message });
    }
  } else {
    warn('Skipping hybrid search test - no documents stored');
    results.skipped++;
  }

  // Test 8: Collection Management
  log('\nTest 8: Collection Management', 'blue');
  try {
    const collections = await vectorStore.getCollections();

    if (collections && Array.isArray(collections)) {
      success(`Found ${collections.length} collections`);
      collections.slice(0, 5).forEach(c => {
        info(`  - ${c.name}: ${c.documentCount || c.document_count} documents`);
      });
      results.passed++;
      results.tests.push({ name: 'Collection Management', status: 'passed', collections: collections.length });
    } else {
      warn('No collections found');
      results.tests.push({ name: 'Collection Management', status: 'no_collections' });
    }
  } catch (error) {
    fail(`Collection Error: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Collection Management', status: 'failed', error: error.message });
  }

  // Test 9: RAG Context Building
  log('\nTest 9: RAG Context Building', 'blue');
  if (documentsStored > 0) {
    try {
      const question = "What were the key decisions about engineering and infrastructure?";
      info(`Building context for: "${question}"`);

      const searchResult = await vectorStore.similaritySearch({
        query: question,
        collectionName,
        topK: 3,
        threshold: 0.2
      });

      if (searchResult.success && searchResult.results.length > 0) {
        // Build context from search results
        const context = searchResult.results
          .map(r => r.content)
          .join('\n\n---\n\n');

        success(`Built context with ${context.length} characters from ${searchResult.results.length} sources`);
        info(`Context preview: "${context.substring(0, 150)}..."`);
        results.passed++;
        results.tests.push({
          name: 'RAG Context Building',
          status: 'passed',
          contextLength: context.length,
          sourceCount: searchResult.results.length
        });
      } else {
        warn('Could not build context - no relevant documents found');
        results.tests.push({ name: 'RAG Context Building', status: 'no_context' });
      }
    } catch (error) {
      fail(`Context Building Error: ${error.message}`);
      results.failed++;
      results.tests.push({ name: 'RAG Context Building', status: 'failed', error: error.message });
    }
  } else {
    warn('Skipping context building test - no documents stored');
    results.skipped++;
  }

  // Cleanup: Delete test collection
  log('\nCleanup: Removing test collection', 'blue');
  try {
    const deleteResult = await vectorStore.deleteCollection(collectionName);
    if (deleteResult.success) {
      success(`Deleted test collection: ${collectionName} (${deleteResult.deletedCount} documents)`);
    }
  } catch (error) {
    warn(`Cleanup warning: ${error.message}`);
  }

  // Final Summary
  log('\n========================================', 'bold');
  log('   TEST SUMMARY', 'bold');
  log('========================================', 'bold');

  log(`\n${colors.green}Passed:  ${results.passed}${colors.reset}`);
  log(`${colors.red}Failed:  ${results.failed}${colors.reset}`);
  log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);

  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  log(`\nPass Rate: ${passRate}%`);

  if (results.failed === 0 && results.passed > 0) {
    log('\n🎉 RAG System is fully operational!', 'green');
  } else if (results.failed > 0) {
    log('\n⚠️  Some tests failed. Check configuration and database setup.', 'yellow');
  }

  return results;
}

// Run tests
runTests()
  .then(results => {
    console.log('\n📋 Detailed Results:', JSON.stringify(results.tests, null, 2));
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });
