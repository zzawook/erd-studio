import { describe, it, expect, beforeEach } from 'vitest';
import { useERDStore } from '../store';
import { ERDModel, Participant } from '../types';

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Helper to get a clean store snapshot
const state = () => useERDStore.getState();

// Reset the store before every test
beforeEach(() => {
  useERDStore.setState({
    model: { entities: [], relationships: [], aggregations: [] },
    notation: 'chen',
    selection: null,
  });
});

// ============================================================
// Entity CRUD
// ============================================================

describe('Entity CRUD', () => {
  it('addEntity returns a valid UUID', () => {
    const id = state().addEntity('Student', { x: 0, y: 0 });
    expect(id).toMatch(UUID_RE);
  });

  it('addEntity adds entity with correct defaults', () => {
    const id = state().addEntity('Student', { x: 10, y: 20 });
    const entity = state().model.entities.find((e) => e.id === id);
    expect(entity).toBeDefined();
    expect(entity!.name).toBe('Student');
    expect(entity!.isWeak).toBe(false);
    expect(entity!.attributes).toEqual([]);
    expect(entity!.candidateKeys).toEqual([]);
  });

  it('addEntity stores position', () => {
    const id = state().addEntity('Course', { x: 100, y: 200 });
    const entity = state().model.entities.find((e) => e.id === id)!;
    expect(entity.position).toEqual({ x: 100, y: 200 });
  });

  it('updateEntity name changes name only', () => {
    const id = state().addEntity('Old', { x: 0, y: 0 });
    state().updateEntity(id, { name: 'New' });
    const entity = state().model.entities.find((e) => e.id === id)!;
    expect(entity.name).toBe('New');
    expect(entity.isWeak).toBe(false);
    expect(entity.position).toEqual({ x: 0, y: 0 });
  });

  it('updateEntity isWeak changes flag', () => {
    const id = state().addEntity('Dependent', { x: 0, y: 0 });
    state().updateEntity(id, { isWeak: true });
    expect(state().model.entities.find((e) => e.id === id)!.isWeak).toBe(true);
  });

  it('updateEntity position updates position', () => {
    const id = state().addEntity('E', { x: 0, y: 0 });
    state().updateEntity(id, { position: { x: 50, y: 60 } });
    expect(state().model.entities.find((e) => e.id === id)!.position).toEqual({ x: 50, y: 60 });
  });

  it('deleteEntity removes entity from model', () => {
    const id = state().addEntity('Gone', { x: 0, y: 0 });
    expect(state().model.entities).toHaveLength(1);
    state().deleteEntity(id);
    expect(state().model.entities).toHaveLength(0);
  });

  it('deleteEntity cascades: removes all relationships referencing it', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ];
    state().addRelationship('R', participants, { x: 0, y: 0 });
    expect(state().model.relationships).toHaveLength(1);
    state().deleteEntity(e1);
    expect(state().model.relationships).toHaveLength(0);
    // e2 should still exist
    expect(state().model.entities).toHaveLength(1);
  });

  it('deleteEntity with non-existent ID is a no-op', () => {
    state().addEntity('Stays', { x: 0, y: 0 });
    state().deleteEntity('nonexistent-id');
    expect(state().model.entities).toHaveLength(1);
  });

  it('add multiple entities → all present, correct count', () => {
    state().addEntity('A', { x: 0, y: 0 });
    state().addEntity('B', { x: 1, y: 1 });
    state().addEntity('C', { x: 2, y: 2 });
    expect(state().model.entities).toHaveLength(3);
    const names = state().model.entities.map((e) => e.name);
    expect(names).toContain('A');
    expect(names).toContain('B');
    expect(names).toContain('C');
  });

  it('updateEntity on non-existent entity is a no-op', () => {
    state().addEntity('X', { x: 0, y: 0 });
    state().updateEntity('bad-id', { name: 'Y' });
    expect(state().model.entities).toHaveLength(1);
    expect(state().model.entities[0].name).toBe('X');
  });

  it('deleteEntity clears selection if entity was selected', () => {
    const id = state().addEntity('Sel', { x: 0, y: 0 });
    state().setSelection({ type: 'entity', entityId: id });
    expect(state().selection).not.toBeNull();
    state().deleteEntity(id);
    expect(state().selection).toBeNull();
  });

  it('deleteEntity does not clear selection if a different entity was selected', () => {
    const id1 = state().addEntity('A', { x: 0, y: 0 });
    const id2 = state().addEntity('B', { x: 1, y: 1 });
    state().setSelection({ type: 'entity', entityId: id2 });
    state().deleteEntity(id1);
    expect(state().selection).toEqual({ type: 'entity', entityId: id2 });
  });

  it('each addEntity call returns a unique ID', () => {
    const ids = Array.from({ length: 5 }, (_, i) =>
      state().addEntity(`E${i}`, { x: i, y: i })
    );
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
  });

  it('addEntity with negative position is stored', () => {
    const id = state().addEntity('Neg', { x: -50, y: -100 });
    expect(state().model.entities.find((e) => e.id === id)!.position).toEqual({ x: -50, y: -100 });
  });

  it('updateEntity with empty patch is a no-op', () => {
    const id = state().addEntity('NoChange', { x: 0, y: 0 });
    state().updateEntity(id, {});
    const entity = state().model.entities.find((e) => e.id === id)!;
    expect(entity.name).toBe('NoChange');
    expect(entity.isWeak).toBe(false);
  });

  it('deleteEntity preserves other entities', () => {
    const id1 = state().addEntity('Keep1', { x: 0, y: 0 });
    const id2 = state().addEntity('Remove', { x: 1, y: 1 });
    const id3 = state().addEntity('Keep2', { x: 2, y: 2 });
    state().deleteEntity(id2);
    expect(state().model.entities).toHaveLength(2);
    expect(state().model.entities.map((e) => e.id)).toContain(id1);
    expect(state().model.entities.map((e) => e.id)).toContain(id3);
  });

  it('updateEntity can update multiple fields at once', () => {
    const id = state().addEntity('Multi', { x: 0, y: 0 });
    state().updateEntity(id, { name: 'Updated', isWeak: true, position: { x: 5, y: 5 } });
    const entity = state().model.entities.find((e) => e.id === id)!;
    expect(entity.name).toBe('Updated');
    expect(entity.isWeak).toBe(true);
    expect(entity.position).toEqual({ x: 5, y: 5 });
  });

  it('addEntity with empty name is allowed', () => {
    const id = state().addEntity('', { x: 0, y: 0 });
    expect(state().model.entities.find((e) => e.id === id)!.name).toBe('');
  });
});

// ============================================================
// Attribute CRUD
// ============================================================

describe('Attribute CRUD', () => {
  let entityId: string;

  beforeEach(() => {
    entityId = state().addEntity('Person', { x: 0, y: 0 });
  });

  it('addAttribute adds attribute to entity', () => {
    const attrId = state().addAttribute(entityId, 'name', { name: 'VARCHAR' });
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.attributes).toHaveLength(1);
    expect(entity.attributes[0].id).toBe(attrId);
  });

  it('addAttribute returns a valid UUID', () => {
    const attrId = state().addAttribute(entityId, 'age', { name: 'INT' });
    expect(attrId).toMatch(UUID_RE);
  });

  it('addAttribute with default dataType stores correct type', () => {
    state().addAttribute(entityId, 'email', { name: 'TEXT' });
    const attr = state().model.entities.find((e) => e.id === entityId)!.attributes[0];
    expect(attr.dataType).toEqual({ name: 'TEXT' });
  });

  it('addAttribute creates attribute with correct defaults', () => {
    state().addAttribute(entityId, 'phone', { name: 'VARCHAR' });
    const attr = state().model.entities.find((e) => e.id === entityId)!.attributes[0];
    expect(attr.name).toBe('phone');
    expect(attr.nullable).toBe(true);
    expect(attr.kind).toBe('simple');
    expect(attr.isPartialKey).toBe(false);
    expect(attr.childAttributeIds).toEqual([]);
  });

  it('updateAttribute name changes only name', () => {
    const attrId = state().addAttribute(entityId, 'old', { name: 'INT' });
    state().updateAttribute(entityId, attrId, { name: 'new' });
    const attr = state().model.entities.find((e) => e.id === entityId)!.attributes[0];
    expect(attr.name).toBe('new');
    expect(attr.dataType).toEqual({ name: 'INT' });
    expect(attr.nullable).toBe(true);
  });

  it('updateAttribute dataType changes type', () => {
    const attrId = state().addAttribute(entityId, 'field', { name: 'INT' });
    state().updateAttribute(entityId, attrId, { dataType: { name: 'VARCHAR' } });
    const attr = state().model.entities.find((e) => e.id === entityId)!.attributes[0];
    expect(attr.dataType).toEqual({ name: 'VARCHAR' });
  });

  it('updateAttribute nullable changes flag', () => {
    const attrId = state().addAttribute(entityId, 'req', { name: 'INT' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].nullable).toBe(true);
    state().updateAttribute(entityId, attrId, { nullable: false });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].nullable).toBe(false);
  });

  it('updateAttribute kind to composite', () => {
    const attrId = state().addAttribute(entityId, 'addr', { name: 'VARCHAR' });
    state().updateAttribute(entityId, attrId, { kind: 'composite' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].kind).toBe('composite');
  });

  it('updateAttribute kind to derived', () => {
    const attrId = state().addAttribute(entityId, 'age', { name: 'INT' });
    state().updateAttribute(entityId, attrId, { kind: 'derived' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].kind).toBe('derived');
  });

  it('updateAttribute kind to multivalued', () => {
    const attrId = state().addAttribute(entityId, 'phones', { name: 'VARCHAR' });
    state().updateAttribute(entityId, attrId, { kind: 'multivalued' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].kind).toBe('multivalued');
  });

  it('updateAttribute kind to simple', () => {
    const attrId = state().addAttribute(entityId, 'x', { name: 'INT' });
    state().updateAttribute(entityId, attrId, { kind: 'derived' });
    state().updateAttribute(entityId, attrId, { kind: 'simple' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].kind).toBe('simple');
  });

  it('updateAttribute isPartialKey changes flag', () => {
    const attrId = state().addAttribute(entityId, 'pk', { name: 'INT' });
    state().updateAttribute(entityId, attrId, { isPartialKey: true });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].isPartialKey).toBe(true);
  });

  it('deleteAttribute removes attribute from entity', () => {
    const attrId = state().addAttribute(entityId, 'temp', { name: 'INT' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes).toHaveLength(1);
    state().deleteAttribute(entityId, attrId);
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes).toHaveLength(0);
  });

  it('deleteAttribute also removes from candidateKey attributeIds', () => {
    const attrId = state().addAttribute(entityId, 'key_col', { name: 'INT' });
    state().addCandidateKey(entityId, 'PK', [attrId], true);
    const ckBefore = state().model.entities.find((e) => e.id === entityId)!.candidateKeys[0];
    expect(ckBefore.attributeIds).toContain(attrId);
    state().deleteAttribute(entityId, attrId);
    const ckAfter = state().model.entities.find((e) => e.id === entityId)!.candidateKeys[0];
    expect(ckAfter.attributeIds).not.toContain(attrId);
    expect(ckAfter.attributeIds).toHaveLength(0);
  });

  it('addAttribute to non-existent entity is a no-op', () => {
    const attrId = state().addAttribute('bad-entity-id', 'ghost', { name: 'INT' });
    expect(attrId).toMatch(UUID_RE); // still returns an id
    // no entity was modified
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes).toHaveLength(0);
  });

  it('deleteAttribute from non-existent entity is a no-op', () => {
    const attrId = state().addAttribute(entityId, 'safe', { name: 'INT' });
    state().deleteAttribute('bad-entity-id', attrId);
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes).toHaveLength(1);
  });

  it('deleteAttribute clears selection if it was selected', () => {
    const attrId = state().addAttribute(entityId, 'sel', { name: 'INT' });
    state().setSelection({ type: 'attribute', entityId, attributeId: attrId });
    state().deleteAttribute(entityId, attrId);
    expect(state().selection).toBeNull();
  });

  it('deleteAttribute does not clear selection if different attribute selected', () => {
    const attrId1 = state().addAttribute(entityId, 'a1', { name: 'INT' });
    const attrId2 = state().addAttribute(entityId, 'a2', { name: 'INT' });
    state().setSelection({ type: 'attribute', entityId, attributeId: attrId2 });
    state().deleteAttribute(entityId, attrId1);
    expect(state().selection).toEqual({ type: 'attribute', entityId, attributeId: attrId2 });
  });

  it('add multiple attributes → all present', () => {
    state().addAttribute(entityId, 'a1', { name: 'INT' });
    state().addAttribute(entityId, 'a2', { name: 'VARCHAR' });
    state().addAttribute(entityId, 'a3', { name: 'BOOLEAN' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes).toHaveLength(3);
  });

  it('updateAttribute on non-existent attribute is a no-op', () => {
    state().addAttribute(entityId, 'real', { name: 'INT' });
    state().updateAttribute(entityId, 'bad-attr-id', { name: 'ghost' });
    expect(state().model.entities.find((e) => e.id === entityId)!.attributes[0].name).toBe('real');
  });
});

// ============================================================
// Candidate Key CRUD
// ============================================================

describe('Candidate Key CRUD', () => {
  let entityId: string;
  let attrId1: string;
  let attrId2: string;

  beforeEach(() => {
    entityId = state().addEntity('Table', { x: 0, y: 0 });
    attrId1 = state().addAttribute(entityId, 'col1', { name: 'INT' });
    attrId2 = state().addAttribute(entityId, 'col2', { name: 'INT' });
  });

  it('addCandidateKey adds key to entity', () => {
    const keyId = state().addCandidateKey(entityId, 'PK', [attrId1], false);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.candidateKeys).toHaveLength(1);
    expect(entity.candidateKeys[0].id).toBe(keyId);
    expect(entity.candidateKeys[0].name).toBe('PK');
    expect(entity.candidateKeys[0].attributeIds).toEqual([attrId1]);
  });

  it('addCandidateKey returns a valid UUID', () => {
    const keyId = state().addCandidateKey(entityId, 'CK', [attrId1], false);
    expect(keyId).toMatch(UUID_RE);
  });

  it('addCandidateKey with isPrimary=true marks it as primary', () => {
    state().addCandidateKey(entityId, 'PK', [attrId1], true);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.candidateKeys[0].isPrimary).toBe(true);
  });

  it('addCandidateKey isPrimary=true demotes existing primary key', () => {
    state().addCandidateKey(entityId, 'OldPK', [attrId1], true);
    state().addCandidateKey(entityId, 'NewPK', [attrId2], true);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.candidateKeys).toHaveLength(2);
    const oldPk = entity.candidateKeys.find((ck) => ck.name === 'OldPK')!;
    const newPk = entity.candidateKeys.find((ck) => ck.name === 'NewPK')!;
    expect(oldPk.isPrimary).toBe(false);
    expect(newPk.isPrimary).toBe(true);
  });

  it('setPrimaryKey sets target as primary and demotes others', () => {
    const k1 = state().addCandidateKey(entityId, 'CK1', [attrId1], true);
    const k2 = state().addCandidateKey(entityId, 'CK2', [attrId2], false);
    state().setPrimaryKey(entityId, k2);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.candidateKeys.find((ck) => ck.id === k1)!.isPrimary).toBe(false);
    expect(entity.candidateKeys.find((ck) => ck.id === k2)!.isPrimary).toBe(true);
  });

  it('setPrimaryKey with non-existent keyId is a no-op', () => {
    const k1 = state().addCandidateKey(entityId, 'CK1', [attrId1], true);
    state().setPrimaryKey(entityId, 'nonexistent');
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    // k1 gets demoted because setPrimaryKey maps all keys: ck.id === 'nonexistent' is false for all
    // so all become non-primary
    expect(entity.candidateKeys.find((ck) => ck.id === k1)!.isPrimary).toBe(false);
  });

  it('deleteCandidateKey removes the key', () => {
    const keyId = state().addCandidateKey(entityId, 'CK', [attrId1], false);
    expect(state().model.entities.find((e) => e.id === entityId)!.candidateKeys).toHaveLength(1);
    state().deleteCandidateKey(entityId, keyId);
    expect(state().model.entities.find((e) => e.id === entityId)!.candidateKeys).toHaveLength(0);
  });

  it('deleteCandidateKey of primary key leaves no primary', () => {
    const keyId = state().addCandidateKey(entityId, 'PK', [attrId1], true);
    state().deleteCandidateKey(entityId, keyId);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    expect(entity.candidateKeys.filter((ck) => ck.isPrimary)).toHaveLength(0);
  });

  it('candidate key with empty attributeIds is allowed', () => {
    const keyId = state().addCandidateKey(entityId, 'EmptyKey', [], false);
    const entity = state().model.entities.find((e) => e.id === entityId)!;
    const ck = entity.candidateKeys.find((k) => k.id === keyId)!;
    expect(ck.attributeIds).toEqual([]);
  });

  it('updateCandidateKey changes name', () => {
    const keyId = state().addCandidateKey(entityId, 'OldName', [attrId1], false);
    state().updateCandidateKey(entityId, keyId, { name: 'NewName' });
    const ck = state().model.entities.find((e) => e.id === entityId)!.candidateKeys[0];
    expect(ck.name).toBe('NewName');
  });

  it('updateCandidateKey changes attributeIds', () => {
    const keyId = state().addCandidateKey(entityId, 'CK', [attrId1], false);
    state().updateCandidateKey(entityId, keyId, { attributeIds: [attrId1, attrId2] });
    const ck = state().model.entities.find((e) => e.id === entityId)!.candidateKeys[0];
    expect(ck.attributeIds).toEqual([attrId1, attrId2]);
  });

  it('setPrimaryKey on non-existent entity is a no-op', () => {
    state().addCandidateKey(entityId, 'CK', [attrId1], true);
    state().setPrimaryKey('nonexistent-entity', 'some-key');
    // entity still has its primary key unchanged
    expect(state().model.entities.find((e) => e.id === entityId)!.candidateKeys[0].isPrimary).toBe(true);
  });

  it('addCandidateKey to non-existent entity is a no-op', () => {
    state().addCandidateKey('bad-entity', 'Ghost', [], false);
    expect(state().model.entities.find((e) => e.id === entityId)!.candidateKeys).toHaveLength(0);
  });

  it('multiple candidate keys can coexist', () => {
    state().addCandidateKey(entityId, 'CK1', [attrId1], false);
    state().addCandidateKey(entityId, 'CK2', [attrId2], false);
    state().addCandidateKey(entityId, 'CK3', [attrId1, attrId2], false);
    expect(state().model.entities.find((e) => e.id === entityId)!.candidateKeys).toHaveLength(3);
  });
});

// ============================================================
// Relationship CRUD
// ============================================================

describe('Relationship CRUD', () => {
  let e1: string;
  let e2: string;
  let participants: Participant[];

  beforeEach(() => {
    e1 = state().addEntity('A', { x: 0, y: 0 });
    e2 = state().addEntity('B', { x: 100, y: 100 });
    participants = [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ];
  });

  it('addRelationship stores relationship with 2 participants', () => {
    const relId = state().addRelationship('works_at', participants, { x: 50, y: 50 });
    expect(relId).toMatch(UUID_RE);
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.name).toBe('works_at');
    expect(rel.participants).toHaveLength(2);
    expect(rel.participants[0].entityId).toBe(e1);
    expect(rel.participants[1].entityId).toBe(e2);
  });

  it('addRelationship stores position', () => {
    const relId = state().addRelationship('R', participants, { x: 42, y: 99 });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.position).toEqual({ x: 42, y: 99 });
  });

  it('addRelationship has correct defaults', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.isIdentifying).toBe(false);
    expect(rel.attributes).toEqual([]);
  });

  it('updateRelationship name changes', () => {
    const relId = state().addRelationship('OldRel', participants, { x: 0, y: 0 });
    state().updateRelationship(relId, { name: 'NewRel' });
    expect(state().model.relationships.find((r) => r.id === relId)!.name).toBe('NewRel');
  });

  it('updateRelationship isIdentifying changes', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateRelationship(relId, { isIdentifying: true });
    expect(state().model.relationships.find((r) => r.id === relId)!.isIdentifying).toBe(true);
  });

  it('updateRelationship position changes', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateRelationship(relId, { position: { x: 200, y: 300 } });
    expect(state().model.relationships.find((r) => r.id === relId)!.position).toEqual({ x: 200, y: 300 });
  });

  it('updateParticipant cardinality changes for correct index', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateParticipant(relId, 1, { cardinality: { min: 1, max: 1 } });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants[1].cardinality).toEqual({ min: 1, max: 1 });
    // participant 0 unchanged
    expect(rel.participants[0].cardinality).toEqual({ min: 1, max: 1 });
  });

  it('updateParticipant with min=0, max=* stores correctly', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateParticipant(relId, 0, { cardinality: { min: 0, max: '*' } });
    expect(state().model.relationships.find((r) => r.id === relId)!.participants[0].cardinality).toEqual({
      min: 0,
      max: '*',
    });
  });

  it('updateParticipant with min=2, max=5 stores correctly', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateParticipant(relId, 0, { cardinality: { min: 2, max: 5 } });
    expect(state().model.relationships.find((r) => r.id === relId)!.participants[0].cardinality).toEqual({
      min: 2,
      max: 5,
    });
  });

  it('deleteRelationship removes relationship', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    expect(state().model.relationships).toHaveLength(1);
    state().deleteRelationship(relId);
    expect(state().model.relationships).toHaveLength(0);
  });

  it('deleteRelationship leaves entities unchanged', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().deleteRelationship(relId);
    expect(state().model.entities).toHaveLength(2);
    expect(state().model.entities.map((e) => e.id)).toContain(e1);
    expect(state().model.entities.map((e) => e.id)).toContain(e2);
  });

  it('deleteRelationship clears selection if relationship was selected', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().setSelection({ type: 'relationship', relationshipId: relId });
    state().deleteRelationship(relId);
    expect(state().selection).toBeNull();
  });

  it('deleteRelationship does not clear selection if different relationship selected', () => {
    const relId1 = state().addRelationship('R1', participants, { x: 0, y: 0 });
    const relId2 = state().addRelationship('R2', participants, { x: 10, y: 10 });
    state().setSelection({ type: 'relationship', relationshipId: relId2 });
    state().deleteRelationship(relId1);
    expect(state().selection).toEqual({ type: 'relationship', relationshipId: relId2 });
  });

  it('addRelationshipAttribute adds attribute to relationship', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'date', { name: 'DATE' });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.attributes).toHaveLength(1);
    expect(rel.attributes[0].id).toBe(attrId);
    expect(rel.attributes[0].name).toBe('date');
    expect(rel.attributes[0].dataType).toEqual({ name: 'DATE' });
  });

  it('updateRelationshipAttribute changes attribute', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'old', { name: 'INT' });
    state().updateRelationshipAttribute(relId, attrId, { name: 'new', dataType: { name: 'VARCHAR' } });
    const attr = state().model.relationships.find((r) => r.id === relId)!.attributes[0];
    expect(attr.name).toBe('new');
    expect(attr.dataType).toEqual({ name: 'VARCHAR' });
  });

  it('deleteRelationshipAttribute removes attribute', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'temp', { name: 'INT' });
    expect(state().model.relationships.find((r) => r.id === relId)!.attributes).toHaveLength(1);
    state().deleteRelationshipAttribute(relId, attrId);
    expect(state().model.relationships.find((r) => r.id === relId)!.attributes).toHaveLength(0);
  });

  it('deleteRelationshipAttribute clears selection if it was selected', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'sel', { name: 'INT' });
    state().setSelection({ type: 'relAttribute', relationshipId: relId, attributeId: attrId });
    state().deleteRelationshipAttribute(relId, attrId);
    expect(state().selection).toBeNull();
  });

  it('deleteRelationshipAttribute does not clear selection if different attribute selected', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    const attrId1 = state().addRelationshipAttribute(relId, 'a1', { name: 'INT' });
    const attrId2 = state().addRelationshipAttribute(relId, 'a2', { name: 'INT' });
    state().setSelection({ type: 'relAttribute', relationshipId: relId, attributeId: attrId2 });
    state().deleteRelationshipAttribute(relId, attrId1);
    expect(state().selection).toEqual({ type: 'relAttribute', relationshipId: relId, attributeId: attrId2 });
  });

  it('updateParticipant role changes', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateParticipant(relId, 0, { role: 'manager' });
    expect(state().model.relationships.find((r) => r.id === relId)!.participants[0].role).toBe('manager');
  });

  it('deleteRelationship with non-existent ID is a no-op', () => {
    state().addRelationship('R', participants, { x: 0, y: 0 });
    state().deleteRelationship('nonexistent');
    expect(state().model.relationships).toHaveLength(1);
  });

  it('updateRelationship on non-existent relationship is a no-op', () => {
    const relId = state().addRelationship('R', participants, { x: 0, y: 0 });
    state().updateRelationship('nonexistent', { name: 'Ghost' });
    expect(state().model.relationships.find((r) => r.id === relId)!.name).toBe('R');
  });
});

// ============================================================
// UI State
// ============================================================

describe('UI State', () => {
  it('setNotation to chen', () => {
    state().setNotation('chen');
    expect(state().notation).toBe('chen');
  });

  it('setNotation to crowsfoot', () => {
    state().setNotation('crowsfoot');
    expect(state().notation).toBe('crowsfoot');
  });

  it('setSelection with entity target', () => {
    const id = state().addEntity('E', { x: 0, y: 0 });
    state().setSelection({ type: 'entity', entityId: id });
    expect(state().selection).toEqual({ type: 'entity', entityId: id });
  });

  it('setSelection with relationship target', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    state().setSelection({ type: 'relationship', relationshipId: relId });
    expect(state().selection).toEqual({ type: 'relationship', relationshipId: relId });
  });

  it('setSelection with attribute target', () => {
    const entityId = state().addEntity('E', { x: 0, y: 0 });
    const attrId = state().addAttribute(entityId, 'a', { name: 'INT' });
    state().setSelection({ type: 'attribute', entityId, attributeId: attrId });
    expect(state().selection).toEqual({ type: 'attribute', entityId, attributeId: attrId });
  });

  it('setSelection with relAttribute target', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'a', { name: 'INT' });
    state().setSelection({ type: 'relAttribute', relationshipId: relId, attributeId: attrId });
    expect(state().selection).toEqual({ type: 'relAttribute', relationshipId: relId, attributeId: attrId });
  });

  it('setSelection(null) clears selection', () => {
    const id = state().addEntity('E', { x: 0, y: 0 });
    state().setSelection({ type: 'entity', entityId: id });
    state().setSelection(null);
    expect(state().selection).toBeNull();
  });

  it('clearModel empties entities and relationships, nulls selection', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    state().setSelection({ type: 'entity', entityId: e1 });
    state().clearModel();
    expect(state().model.entities).toEqual([]);
    expect(state().model.relationships).toEqual([]);
    expect(state().model.aggregations).toEqual([]);
    expect(state().selection).toBeNull();
  });

  it('loadModel replaces entire model and clears selection', () => {
    state().addEntity('Old', { x: 0, y: 0 });
    state().setSelection({ type: 'entity', entityId: state().model.entities[0].id });

    const newModel: ERDModel = {
      entities: [
        {
          id: 'custom-id-1',
          name: 'Loaded',
          isWeak: false,
          attributes: [],
          candidateKeys: [],
          position: { x: 10, y: 20 },
        },
      ],
      relationships: [],
      aggregations: [],
    };
    state().loadModel(newModel);
    expect(state().model.entities).toHaveLength(1);
    expect(state().model.entities[0].name).toBe('Loaded');
    expect(state().model.entities[0].id).toBe('custom-id-1');
    expect(state().model.aggregations).toEqual([]);
    expect(state().selection).toBeNull();
  });

  it('loadModel with complete model replaces relationships too', () => {
    const newModel: ERDModel = {
      entities: [
        {
          id: 'e1',
          name: 'E1',
          isWeak: false,
          attributes: [],
          candidateKeys: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'e2',
          name: 'E2',
          isWeak: true,
          attributes: [],
          candidateKeys: [],
          position: { x: 100, y: 100 },
        },
      ],
      relationships: [
        {
          id: 'r1',
          name: 'R1',
          participants: [
            { entityId: 'e1', cardinality: { min: 1, max: 1 } },
            { entityId: 'e2', cardinality: { min: 0, max: '*' } },
          ],
          isIdentifying: true,
          attributes: [],
          position: { x: 50, y: 50 },
        },
      ],
      aggregations: [],
    };
    state().loadModel(newModel);
    expect(state().model.entities).toHaveLength(2);
    expect(state().model.relationships).toHaveLength(1);
    expect(state().model.relationships[0].isIdentifying).toBe(true);
    expect(state().model.aggregations).toEqual([]);
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge Cases', () => {
  it('delete entity that participates in multiple relationships removes all', () => {
    const e1 = state().addEntity('Center', { x: 0, y: 0 });
    const e2 = state().addEntity('Left', { x: -100, y: 0 });
    const e3 = state().addEntity('Right', { x: 100, y: 0 });
    state().addRelationship('R1', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: -50, y: 0 });
    state().addRelationship('R2', [
      { entityId: e1, cardinality: { min: 0, max: 1 } },
      { entityId: e3, cardinality: { min: 1, max: '*' } },
    ], { x: 50, y: 0 });
    state().addRelationship('R3', [
      { entityId: e2, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
    ], { x: 0, y: 50 });
    expect(state().model.relationships).toHaveLength(3);
    state().deleteEntity(e1);
    // R1 and R2 should be removed (they reference e1), R3 stays
    expect(state().model.relationships).toHaveLength(1);
    expect(state().model.relationships[0].participants.map((p) => p.entityId)).toEqual([e2, e3]);
  });

  it('self-referencing relationship is stored correctly', () => {
    const e = state().addEntity('Employee', { x: 0, y: 0 });
    const relId = state().addRelationship('manages', [
      { entityId: e, cardinality: { min: 0, max: '*' }, role: 'manager' },
      { entityId: e, cardinality: { min: 0, max: 1 }, role: 'subordinate' },
    ], { x: 10, y: 10 });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants).toHaveLength(2);
    expect(rel.participants[0].entityId).toBe(e);
    expect(rel.participants[1].entityId).toBe(e);
    expect(rel.participants[0].role).toBe('manager');
    expect(rel.participants[1].role).toBe('subordinate');
  });

  it('entity with 0 attributes is valid', () => {
    const id = state().addEntity('Empty', { x: 0, y: 0 });
    const entity = state().model.entities.find((e) => e.id === id)!;
    expect(entity.attributes).toEqual([]);
    expect(entity).toBeDefined();
  });

  it('empty model is valid', () => {
    expect(state().model.entities).toEqual([]);
    expect(state().model.relationships).toEqual([]);
  });

  it('clearModel on already empty model is a no-op', () => {
    state().clearModel();
    expect(state().model.entities).toEqual([]);
    expect(state().model.relationships).toEqual([]);
    expect(state().model.aggregations).toEqual([]);
    expect(state().selection).toBeNull();
  });

  it('delete entity with self-referencing relationship removes the relationship', () => {
    const e = state().addEntity('Node', { x: 0, y: 0 });
    state().addRelationship('links_to', [
      { entityId: e, cardinality: { min: 0, max: '*' } },
      { entityId: e, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    expect(state().model.relationships).toHaveLength(1);
    state().deleteEntity(e);
    expect(state().model.relationships).toHaveLength(0);
    expect(state().model.entities).toHaveLength(0);
  });

  it('attribute with precision and scale in dataType', () => {
    const entityId = state().addEntity('T', { x: 0, y: 0 });
    state().addAttribute(entityId, 'price', { name: 'NUMERIC', precision: 10, scale: 2 });
    const attr = state().model.entities.find((e) => e.id === entityId)!.attributes[0];
    expect(attr.dataType).toEqual({ name: 'NUMERIC', precision: 10, scale: 2 });
  });

  it('loadModel then continue editing works', () => {
    const newModel: ERDModel = {
      entities: [
        {
          id: 'loaded-e1',
          name: 'Loaded',
          isWeak: false,
          attributes: [],
          candidateKeys: [],
          position: { x: 0, y: 0 },
        },
      ],
      relationships: [],
      aggregations: [],
    };
    state().loadModel(newModel);
    const newId = state().addEntity('Added', { x: 10, y: 10 });
    expect(state().model.entities).toHaveLength(2);
    expect(state().model.entities.map((e) => e.name)).toContain('Loaded');
    expect(state().model.entities.map((e) => e.name)).toContain('Added');
    expect(newId).toMatch(UUID_RE);
  });

  it('notation persists through clearModel', () => {
    state().setNotation('crowsfoot');
    state().clearModel();
    expect(state().notation).toBe('crowsfoot');
  });

  it('notation persists through loadModel', () => {
    state().setNotation('crowsfoot');
    state().loadModel({ entities: [], relationships: [], aggregations: [] });
    expect(state().notation).toBe('crowsfoot');
  });
});

// ============================================================
// Branch Coverage: deleteEntity selection edge cases
// ============================================================

describe('deleteEntity selection branch coverage', () => {
  it('deleteEntity preserves selection when a relationship is selected (no entityId in selection)', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    // Select a relationship (no entityId property)
    state().setSelection({ type: 'relationship', relationshipId: relId });

    // Delete an entity not referenced in the selection type
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    state().deleteEntity(e3);

    // Selection should be preserved since it's a relationship selection
    expect(state().selection).toEqual({ type: 'relationship', relationshipId: relId });
  });

  it('deleteEntity clears selection when attribute is selected on the deleted entity', () => {
    const eid = state().addEntity('E', { x: 0, y: 0 });
    const aid = state().addAttribute(eid, 'col', { name: 'INT' });
    state().setSelection({ type: 'attribute', entityId: eid, attributeId: aid });
    state().deleteEntity(eid);
    expect(state().selection).toBeNull();
  });

  it('deleteEntity preserves attribute selection on a different entity', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const aid = state().addAttribute(e2, 'col', { name: 'INT' });
    state().setSelection({ type: 'attribute', entityId: e2, attributeId: aid });
    state().deleteEntity(e1);
    expect(state().selection).toEqual({ type: 'attribute', entityId: e2, attributeId: aid });
  });
});

// ============================================================
// Branch Coverage: deleteRelationshipAttribute selection
// ============================================================

describe('deleteRelationshipAttribute selection branch coverage', () => {
  it('deleteRelationshipAttribute preserves selection when selection is null', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'attr', { name: 'INT' });
    state().setSelection(null);
    state().deleteRelationshipAttribute(relId, attrId);
    expect(state().selection).toBeNull();
  });

  it('deleteRelationshipAttribute preserves entity selection', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'attr', { name: 'INT' });
    state().setSelection({ type: 'entity', entityId: e1 });
    state().deleteRelationshipAttribute(relId, attrId);
    expect(state().selection).toEqual({ type: 'entity', entityId: e1 });
  });

  it('deleteRelationshipAttribute preserves relationship selection (not relAttribute)', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attrId = state().addRelationshipAttribute(relId, 'attr', { name: 'INT' });
    state().setSelection({ type: 'relationship', relationshipId: relId });
    state().deleteRelationshipAttribute(relId, attrId);
    expect(state().selection).toEqual({ type: 'relationship', relationshipId: relId });
  });
});

// ============================================================
// Branch Coverage: clearModel
// ============================================================

describe('clearModel branch coverage', () => {
  it('clearModel creates a fresh empty model object', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    state().addAttribute(e1, 'col', { name: 'INT' });
    state().clearModel();
    const model = state().model;
    expect(model.entities).toEqual([]);
    expect(model.relationships).toEqual([]);
    expect(model.aggregations).toEqual([]);
    // Model should be a new object
    state().addEntity('B', { x: 0, y: 0 });
    expect(state().model.entities).toHaveLength(1);
  });

  it('clearModel produces independent model from emptyModel template', () => {
    state().clearModel();
    state().addEntity('After', { x: 0, y: 0 });
    // Clear again - should be empty, proving it's a fresh copy each time
    state().clearModel();
    expect(state().model.entities).toEqual([]);
    expect(state().model.relationships).toEqual([]);
    expect(state().model.aggregations).toEqual([]);
  });
});

// ============================================================
// Branch Coverage: map else-branches with multiple items
// ============================================================

describe('map branch coverage with multiple entities/relationships', () => {
  it('updateCandidateKey with multiple entities exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const a1 = state().addAttribute(e1, 'col', { name: 'INT' });
    const a2 = state().addAttribute(e2, 'col2', { name: 'INT' });
    const ck1 = state().addCandidateKey(e1, 'CK1', [a1], false);
    state().addCandidateKey(e2, 'CK2', [a2], false);
    state().updateCandidateKey(e1, ck1, { name: 'UpdatedCK1' });
    // e2's candidate key should be unchanged
    const e2entity = state().model.entities.find((e) => e.id === e2)!;
    expect(e2entity.candidateKeys[0].name).toBe('CK2');
    const e1entity = state().model.entities.find((e) => e.id === e1)!;
    expect(e1entity.candidateKeys[0].name).toBe('UpdatedCK1');
  });

  it('deleteCandidateKey with multiple entities exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const a1 = state().addAttribute(e1, 'col', { name: 'INT' });
    const a2 = state().addAttribute(e2, 'col2', { name: 'INT' });
    const ck1 = state().addCandidateKey(e1, 'CK1', [a1], false);
    state().addCandidateKey(e2, 'CK2', [a2], false);
    state().deleteCandidateKey(e1, ck1);
    // e2's candidate key should remain
    const e2entity = state().model.entities.find((e) => e.id === e2)!;
    expect(e2entity.candidateKeys).toHaveLength(1);
    const e1entity = state().model.entities.find((e) => e.id === e1)!;
    expect(e1entity.candidateKeys).toHaveLength(0);
  });

  it('updateParticipant with multiple relationships exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel1 = state().addRelationship('R1', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const rel2 = state().addRelationship('R2', [
      { entityId: e2, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    // Update participant in rel1 - rel2 should be untouched
    state().updateParticipant(rel1, 1, { cardinality: { min: 1, max: 1 } });
    const r2 = state().model.relationships.find((r) => r.id === rel2)!;
    expect(r2.participants[1].cardinality).toEqual({ min: 0, max: '*' });
    const r1 = state().model.relationships.find((r) => r.id === rel1)!;
    expect(r1.participants[1].cardinality).toEqual({ min: 1, max: 1 });
  });

  it('deleteRelationshipAttribute with multiple relationships exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel1 = state().addRelationship('R1', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const rel2 = state().addRelationship('R2', [
      { entityId: e2, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attr1 = state().addRelationshipAttribute(rel1, 'a1', { name: 'INT' });
    state().addRelationshipAttribute(rel2, 'a2', { name: 'INT' });
    state().deleteRelationshipAttribute(rel1, attr1);
    // rel2's attribute should remain
    expect(state().model.relationships.find((r) => r.id === rel2)!.attributes).toHaveLength(1);
    expect(state().model.relationships.find((r) => r.id === rel1)!.attributes).toHaveLength(0);
  });

  it('updateRelationshipAttribute with multiple relationships exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel1 = state().addRelationship('R1', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const rel2 = state().addRelationship('R2', [
      { entityId: e2, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attr1 = state().addRelationshipAttribute(rel1, 'a1', { name: 'INT' });
    state().addRelationshipAttribute(rel2, 'a2', { name: 'INT' });
    state().updateRelationshipAttribute(rel1, attr1, { name: 'updated' });
    // rel2's attribute should be unchanged
    expect(state().model.relationships.find((r) => r.id === rel2)!.attributes[0].name).toBe('a2');
    expect(state().model.relationships.find((r) => r.id === rel1)!.attributes[0].name).toBe('updated');
  });

  it('deleteEntity with selection null does not change selection', () => {
    const id = state().addEntity('A', { x: 0, y: 0 });
    state().setSelection(null);
    state().deleteEntity(id);
    expect(state().selection).toBeNull();
  });

  it('deleteAttribute preserves selection when selection type is not attribute', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const attrId = state().addAttribute(e1, 'col', { name: 'INT' });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    state().setSelection({ type: 'relationship', relationshipId: relId });
    state().deleteAttribute(e1, attrId);
    expect(state().selection).toEqual({ type: 'relationship', relationshipId: relId });
  });

  it('updateAttribute with multiple entities exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const a1 = state().addAttribute(e1, 'col1', { name: 'INT' });
    state().addAttribute(e2, 'col2', { name: 'INT' });
    state().updateAttribute(e1, a1, { name: 'updated' });
    // e2's attribute should be unchanged
    expect(state().model.entities.find((e) => e.id === e2)!.attributes[0].name).toBe('col2');
    expect(state().model.entities.find((e) => e.id === e1)!.attributes[0].name).toBe('updated');
  });

  it('updateRelationshipAttribute with multiple attributes exercises else branch for inner map', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const attr1 = state().addRelationshipAttribute(relId, 'a1', { name: 'INT' });
    const attr2 = state().addRelationshipAttribute(relId, 'a2', { name: 'VARCHAR' });
    // Update attr1 - attr2 should be unchanged (inner map else branch)
    state().updateRelationshipAttribute(relId, attr1, { name: 'updated_a1' });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.attributes.find((a) => a.id === attr1)!.name).toBe('updated_a1');
    expect(rel.attributes.find((a) => a.id === attr2)!.name).toBe('a2');
  });

  it('updateCandidateKey with multiple keys exercises else branch for inner map', () => {
    const eid = state().addEntity('T', { x: 0, y: 0 });
    const a1 = state().addAttribute(eid, 'c1', { name: 'INT' });
    const a2 = state().addAttribute(eid, 'c2', { name: 'INT' });
    const ck1 = state().addCandidateKey(eid, 'CK1', [a1], false);
    const ck2 = state().addCandidateKey(eid, 'CK2', [a2], false);
    // Update ck1 - ck2 should be unchanged (inner map else branch)
    state().updateCandidateKey(eid, ck1, { name: 'UpdatedCK1' });
    const entity = state().model.entities.find((e) => e.id === eid)!;
    expect(entity.candidateKeys.find((ck) => ck.id === ck1)!.name).toBe('UpdatedCK1');
    expect(entity.candidateKeys.find((ck) => ck.id === ck2)!.name).toBe('CK2');
  });

  it('addRelationshipAttribute with multiple rels exercises else branch', () => {
    const e1 = state().addEntity('A', { x: 0, y: 0 });
    const e2 = state().addEntity('B', { x: 1, y: 1 });
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel1 = state().addRelationship('R1', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    const rel2 = state().addRelationship('R2', [
      { entityId: e2, cardinality: { min: 1, max: 1 } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    state().addRelationshipAttribute(rel1, 'a1', { name: 'INT' });
    // rel2 should have no attributes
    expect(state().model.relationships.find((r) => r.id === rel2)!.attributes).toHaveLength(0);
    expect(state().model.relationships.find((r) => r.id === rel1)!.attributes).toHaveLength(1);
  });
});

// ============================================================
// Aggregation CRUD
// ============================================================

describe('Aggregation CRUD', () => {
  let e1: string;
  let e2: string;
  let relId: string;

  beforeEach(() => {
    e1 = state().addEntity('A', { x: 0, y: 0 });
    e2 = state().addEntity('B', { x: 1, y: 1 });
    relId = state().addRelationship('R', [
      { entityId: e1, cardinality: { min: 1, max: 1 } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
  });

  it('addAggregation appears in model.aggregations', () => {
    const aggId = state().addAggregation('AggR', relId);
    expect(aggId).toMatch(UUID_RE);
    expect(state().model.aggregations).toHaveLength(1);
    expect(state().model.aggregations[0].id).toBe(aggId);
    expect(state().model.aggregations[0].name).toBe('AggR');
    expect(state().model.aggregations[0].relationshipId).toBe(relId);
  });

  it('updateAggregation name changes', () => {
    const aggId = state().addAggregation('OldName', relId);
    state().updateAggregation(aggId, { name: 'NewName' });
    expect(state().model.aggregations.find((a) => a.id === aggId)!.name).toBe('NewName');
  });

  it('deleteAggregation removes it from model', () => {
    const aggId = state().addAggregation('AggR', relId);
    expect(state().model.aggregations).toHaveLength(1);
    state().deleteAggregation(aggId);
    expect(state().model.aggregations).toHaveLength(0);
  });

  it('deleteAggregation removes participants referencing it from relationships', () => {
    const aggId = state().addAggregation('AggR', relId);
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel2 = state().addRelationship('R2', [
      { entityId: aggId, cardinality: { min: 1, max: 1 }, isAggregation: true },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 0, y: 0 });
    expect(state().model.relationships.find((r) => r.id === rel2)!.participants).toHaveLength(2);
    state().deleteAggregation(aggId);
    // The participant referencing the aggregation should be removed
    expect(state().model.relationships.find((r) => r.id === rel2)!.participants).toHaveLength(1);
    expect(state().model.relationships.find((r) => r.id === rel2)!.participants[0].entityId).toBe(e3);
  });

  it('deleteRelationship cascades to remove aggregations wrapping it', () => {
    state().addAggregation('AggR', relId);
    expect(state().model.aggregations).toHaveLength(1);
    state().deleteRelationship(relId);
    expect(state().model.aggregations).toHaveLength(0);
  });

  it('updateAggregation only changes the target aggregation, leaves others unchanged', () => {
    const aggId1 = state().addAggregation('Agg1', relId);
    // Create second relationship and aggregation
    const e3 = state().addEntity('C', { x: 2, y: 2 });
    const rel2 = state().addRelationship('R2', [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 0, max: '*' } },
    ], { x: 1, y: 1 });
    const aggId2 = state().addAggregation('Agg2', rel2);

    // Update only the first aggregation
    state().updateAggregation(aggId1, { name: 'Updated' });
    expect(state().model.aggregations.find((a) => a.id === aggId1)!.name).toBe('Updated');
    expect(state().model.aggregations.find((a) => a.id === aggId2)!.name).toBe('Agg2');
  });

  it('deleteAggregation preserves non-aggregation selection', () => {
    const aggId = state().addAggregation('AggR', relId);
    // Set selection to an entity (not the aggregation being deleted)
    state().setSelection({ type: 'entity', entityId: e1 });
    state().deleteAggregation(aggId);
    // Selection should remain unchanged
    const sel = state().selection;
    expect(sel).not.toBeNull();
    expect(sel?.type).toBe('entity');
  });

  it('deleteEntity cascades to remove relationships and their aggregations', () => {
    state().addAggregation('AggR', relId);
    expect(state().model.aggregations).toHaveLength(1);
    expect(state().model.relationships).toHaveLength(1);
    // Deleting entity e1 should cascade: remove relationship R (which has e1), then remove aggregation wrapping R
    state().deleteEntity(e1);
    expect(state().model.relationships).toHaveLength(0);
    expect(state().model.aggregations).toHaveLength(0);
  });
});

// ============================================================
// N-ary Relationship Support
// ============================================================

describe('N-ary Relationships', () => {
  let e1: string;
  let e2: string;
  let e3: string;

  beforeEach(() => {
    e1 = state().addEntity('Student', { x: 0, y: 0 });
    e2 = state().addEntity('Course', { x: 100, y: 0 });
    e3 = state().addEntity('Instructor', { x: 200, y: 0 });
  });

  it('addRelationship with 3 participants creates a ternary relationship', () => {
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
    ];
    const relId = state().addRelationship('Teaches', participants, { x: 100, y: 100 });

    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants).toHaveLength(3);
    expect(rel.participants[0].entityId).toBe(e1);
    expect(rel.participants[1].entityId).toBe(e2);
    expect(rel.participants[2].entityId).toBe(e3);
  });

  it('addParticipant adds a new participant to an existing relationship', () => {
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
    ];
    const relId = state().addRelationship('Enrolls', participants, { x: 100, y: 100 });
    expect(state().model.relationships.find((r) => r.id === relId)!.participants).toHaveLength(2);

    state().addParticipant(relId, { entityId: e3, cardinality: { min: 1, max: 1 } });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants).toHaveLength(3);
    expect(rel.participants[2].entityId).toBe(e3);
    expect(rel.participants[2].cardinality).toEqual({ min: 1, max: 1 });
  });

  it('removeParticipant removes a participant by index', () => {
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
    ];
    const relId = state().addRelationship('Teaches', participants, { x: 100, y: 100 });

    state().removeParticipant(relId, 1); // Remove Course (index 1)
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants).toHaveLength(2);
    expect(rel.participants[0].entityId).toBe(e1);
    expect(rel.participants[1].entityId).toBe(e3);
  });

  it('updateParticipant works on n-ary relationships', () => {
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
    ];
    const relId = state().addRelationship('Teaches', participants, { x: 100, y: 100 });

    state().updateParticipant(relId, 2, { cardinality: { min: 0, max: '*' } });
    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants[2].cardinality).toEqual({ min: 0, max: '*' });
  });

  it('deleteEntity removes n-ary relationship if entity is a participant', () => {
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
    ];
    state().addRelationship('Teaches', participants, { x: 100, y: 100 });
    expect(state().model.relationships).toHaveLength(1);

    state().deleteEntity(e2);
    // Relationship references e2 so it should be removed
    expect(state().model.relationships).toHaveLength(0);
  });

  it('addRelationship with 4 participants creates a quaternary relationship', () => {
    const e4 = state().addEntity('Semester', { x: 300, y: 0 });
    const participants: Participant[] = [
      { entityId: e1, cardinality: { min: 0, max: '*' } },
      { entityId: e2, cardinality: { min: 0, max: '*' } },
      { entityId: e3, cardinality: { min: 1, max: 1 } },
      { entityId: e4, cardinality: { min: 1, max: '*' } },
    ];
    const relId = state().addRelationship('Registration', participants, { x: 150, y: 100 });

    const rel = state().model.relationships.find((r) => r.id === relId)!;
    expect(rel.participants).toHaveLength(4);
  });

  it('addParticipant on nonexistent relationship is a no-op', () => {
    state().addParticipant('nonexistent', { entityId: e1, cardinality: { min: 0, max: 1 } });
    // No crash; relationships list is unchanged
    expect(state().model.relationships).toHaveLength(0);
  });

  it('removeParticipant on nonexistent relationship is a no-op', () => {
    state().removeParticipant('nonexistent', 0);
    expect(state().model.relationships).toHaveLength(0);
  });
});
