// ============================================================
// Data Types
// ============================================================

export interface DataType {
  name: string;
  precision?: number;
  scale?: number;
}

export const DATA_TYPE_NAMES = [
  'VARCHAR', 'TEXT', 'INT', 'BIGINT', 'SMALLINT',
  'NUMERIC', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TIMESTAMPTZ',
  'UUID', 'JSONB', 'BYTEA',
] as const;

// ============================================================
// Attribute
// ============================================================

export type AttributeKind =
  | 'simple'
  | 'composite'
  | 'derived'
  | 'multivalued';

export interface Attribute {
  id: string;
  name: string;
  dataType: DataType;
  nullable: boolean;
  kind: AttributeKind;
  isPartialKey: boolean;
  childAttributeIds: string[];
}

// ============================================================
// Candidate Key
// ============================================================

export interface CandidateKey {
  id: string;
  name: string;
  attributeIds: string[];
  isPrimary: boolean;
}

// ============================================================
// Entity
// ============================================================

export interface Entity {
  id: string;
  name: string;
  isWeak: boolean;
  attributes: Attribute[];
  candidateKeys: CandidateKey[];
  position: { x: number; y: number };
}

// ============================================================
// Cardinality
// ============================================================

export interface Cardinality {
  min: number;
  max: number | '*';
}

// ============================================================
// Relationship Participant
// ============================================================

export interface Participant {
  entityId: string; // references Entity.id or Aggregation.id
  cardinality: Cardinality;
  role?: string;
  isAggregation?: boolean; // true if entityId refers to an Aggregation
}

// ============================================================
// Relationship
// ============================================================

export interface Relationship {
  id: string;
  name: string;
  participants: Participant[];
  isIdentifying: boolean;
  attributes: Attribute[];
  position: { x: number; y: number };
}

// ============================================================
// Aggregation
// ============================================================

export interface Aggregation {
  id: string;
  name: string;
  relationshipId: string; // the relationship being aggregated
}

// ============================================================
// ERD Model
// ============================================================

export interface ERDModel {
  entities: Entity[];
  relationships: Relationship[];
  aggregations: Aggregation[];
}

// ============================================================
// Notation type
// ============================================================

export type NotationType = 'chen' | 'crowsfoot';

// ============================================================
// Selection state
// ============================================================

export type SelectionTarget =
  | { type: 'entity'; entityId: string }
  | { type: 'relationship'; relationshipId: string }
  | { type: 'attribute'; entityId: string; attributeId: string }
  | { type: 'relAttribute'; relationshipId: string; attributeId: string }
  | { type: 'aggregation'; aggregationId: string }
  | null;
