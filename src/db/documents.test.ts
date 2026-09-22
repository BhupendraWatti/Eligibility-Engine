import assert from 'node:assert';
import {
  getAllDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  getAuditLogs,
} from './queries';

async function runDocumentsCrudTests() {
  console.log('--- Running Documents CRUD Tests ---');

  // 1. READ: Initial documents check
  const initialDocs = await getAllDocuments();
  assert(Array.isArray(initialDocs), 'getAllDocuments must return an array');
  assert(initialDocs.length >= 5, 'Initial documents should contain at least 5 fallback records');
  console.log(`✅ READ PASSED: Loaded ${initialDocs.length} initial documents`);

  // 2. CREATE: Add new document
  const newDocData = {
    recruitmentId: 'rec_mp_constable_2026',
    title: 'Test MP Police Medical Exam Guidelines 2026',
    sourceType: 'OFFICIAL_NOTIFICATION_PDF',
    sourceUrl: 'https://esb.mp.gov.in/notices/medical_guidelines_2026.pdf',
    publicationDate: '2026-09-22',
    adminEmail: 'test-admin@rozgarsetu.in',
  };

  const createdId = await createDocument(newDocData);
  assert(typeof createdId === 'string' && createdId.startsWith('src_'), 'createDocument must return an ID starting with src_');

  const afterCreateDocs = await getAllDocuments();
  const createdDoc = afterCreateDocs.find(d => d.id === createdId);
  assert(createdDoc !== undefined, 'Newly created document must be present in getAllDocuments');
  assert.strictEqual(createdDoc.title, newDocData.title, 'Created document title must match input');
  assert.strictEqual(createdDoc.url, newDocData.sourceUrl, 'Created document URL must match input');
  console.log(`✅ CREATE PASSED: Created document with ID: ${createdId}`);

  // 3. UPDATE: Modify document
  const updatedTitle = 'Test MP Police Revised Medical Guidelines 2026';
  const updatedUrl = 'https://esb.mp.gov.in/notices/revised_medical_guidelines_2026.pdf';
  const updateSuccess = await updateDocument({
    id: createdId,
    title: updatedTitle,
    sourceUrl: updatedUrl,
    sourceType: 'CORRECTION_NOTICE',
    adminEmail: 'test-admin@rozgarsetu.in',
  });

  assert.strictEqual(updateSuccess, true, 'updateDocument should return true on success');

  const afterUpdateDocs = await getAllDocuments();
  const updatedDoc = afterUpdateDocs.find(d => d.id === createdId);
  assert(updatedDoc !== undefined, 'Updated document must exist');
  assert.strictEqual(updatedDoc.title, updatedTitle, 'Document title must be updated');
  assert.strictEqual(updatedDoc.url, updatedUrl, 'Document URL must be updated');
  assert.strictEqual(updatedDoc.type, 'Correction notice', 'Document type must reflect updated notice type');
  console.log('✅ UPDATE PASSED: Document successfully updated');

  // 4. DELETE: Remove document
  const deleteSuccess = await deleteDocument({
    id: createdId,
    adminEmail: 'test-admin@rozgarsetu.in',
  });

  assert.strictEqual(deleteSuccess, true, 'deleteDocument should return true on success');

  const afterDeleteDocs = await getAllDocuments();
  const deletedDoc = afterDeleteDocs.find(d => d.id === createdId);
  assert(deletedDoc === undefined, 'Deleted document must no longer exist in getAllDocuments');
  console.log('✅ DELETE PASSED: Document successfully deleted');

  // 5. AUDIT LOGS: Verify audit entries
  const auditLogs = await getAuditLogs();
  const docAuditLogs = auditLogs.filter((l: any) => l.entity === 'SOURCE');
  assert(docAuditLogs.length >= 3, 'Audit logs must record CREATE, UPDATE, and DELETE actions for SOURCE');
  console.log('✅ AUDIT LOGS PASSED: Operational traceability recorded for all CRUD actions');

  console.log('\n🎉 ALL DOCUMENTS CRUD TESTS PASSED SUCCESSFULLY!\n');
}

runDocumentsCrudTests().catch((err) => {
  console.error('❌ Documents CRUD test failed:', err);
  process.exit(1);
});
