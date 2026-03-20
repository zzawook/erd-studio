import { create } from 'zustand';
import type {
  ERDModel, Entity, Relationship, Attribute, CandidateKey,
  Participant, NotationType, SelectionTarget, DataType, Aggregation,
} from './types';
import { generateId } from '../utils/id';

// ============================================================
// Store State Interface
// ============================================================

export interface ERDState {
  model: ERDModel;
  notation: NotationType;
  selection: SelectionTarget;
  /** Tracks dragged positions for nodes without IR-level position (e.g. attribute ovals) */
  nodePositions: Record<string, { x: number; y: number }>;

  // Entity actions
  addEntity: (name: string, position: { x: number; y: number }) => string;
  updateEntity: (id: string, patch: Partial<Pick<Entity, 'name' | 'isWeak' | 'position'>>) => void;
  deleteEntity: (id: string) => void;

  // Attribute actions
  addAttribute: (entityId: string, name: string, dataType: DataType) => string;
  updateAttribute: (entityId: string, attrId: string, patch: Partial<Omit<Attribute, 'id'>>) => void;
  deleteAttribute: (entityId: string, attrId: string) => void;

  // Relationship attribute actions
  addRelationshipAttribute: (relId: string, name: string, dataType: DataType) => string;
  updateRelationshipAttribute: (relId: string, attrId: string, patch: Partial<Omit<Attribute, 'id'>>) => void;
  deleteRelationshipAttribute: (relId: string, attrId: string) => void;

  // Candidate Key actions
  addCandidateKey: (entityId: string, name: string, attributeIds: string[], isPrimary: boolean) => string;
  updateCandidateKey: (entityId: string, keyId: string, patch: Partial<Omit<CandidateKey, 'id'>>) => void;
  deleteCandidateKey: (entityId: string, keyId: string) => void;
  setPrimaryKey: (entityId: string, keyId: string) => void;

  // Relationship actions
  addRelationship: (name: string, participants: Participant[], position: { x: number; y: number }) => string;
  updateRelationship: (id: string, patch: Partial<Pick<Relationship, 'name' | 'isIdentifying' | 'position'>>) => void;
  updateParticipant: (relId: string, index: number, patch: Partial<Participant>) => void;
  deleteRelationship: (id: string) => void;

  // Aggregation actions
  addAggregation: (name: string, relationshipId: string) => string;
  updateAggregation: (id: string, patch: Partial<Pick<Aggregation, 'name'>>) => void;
  deleteAggregation: (id: string) => void;

  // Node position tracking (for attributes etc.)
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => void;

  // UI actions
  setNotation: (notation: NotationType) => void;
  setSelection: (selection: SelectionTarget) => void;

  // Bulk actions
  loadModel: (model: ERDModel) => void;
  clearModel: () => void;
}

// ============================================================
// Helper: create a default attribute
// ============================================================

function createAttribute(name: string, dataType: DataType): Attribute {
  return {
    id: generateId(),
    name,
    dataType,
    nullable: true,
    kind: 'simple',
    isPartialKey: false,
    childAttributeIds: [],
  };
}

// ============================================================
// Store
// ============================================================

const emptyModel: ERDModel = { entities: [], relationships: [], aggregations: [] };

export const useERDStore = create<ERDState>((set, get) => ({
  model: { entities: [], relationships: [], aggregations: [] },
  notation: 'chen',
  selection: null,
  nodePositions: {},

  // ---- Entity actions ----

  addEntity: (name, position) => {
    const id = generateId();
    const entity: Entity = {
      id,
      name,
      isWeak: false,
      attributes: [],
      candidateKeys: [],
      position,
    };
    set((state) => ({
      model: {
        ...state.model,
        entities: [...state.model.entities, entity],
      },
    }));
    return id;
  },

  updateEntity: (id, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === id ? { ...e, ...patch } : e
        ),
      },
    }));
  },

  deleteEntity: (id) => {
    set((state) => {
      const removedRelIds = new Set(
        state.model.relationships
          .filter((r) => r.participants.some((p) => p.entityId === id && !p.isAggregation))
          .map((r) => r.id)
      );
      return {
        model: {
          entities: state.model.entities.filter((e) => e.id !== id),
          relationships: state.model.relationships.filter(
            (r) => !r.participants.some((p) => p.entityId === id && !p.isAggregation)
          ),
          aggregations: state.model.aggregations.filter(
            (a) => !removedRelIds.has(a.relationshipId)
          ),
        },
        selection: state.selection && 'entityId' in state.selection && state.selection.entityId === id
          ? null
          : state.selection,
      };
    });
  },

  // ---- Attribute actions ----

  addAttribute: (entityId, name, dataType) => {
    const attr = createAttribute(name, dataType);
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? { ...e, attributes: [...e.attributes, attr] }
            : e
        ),
      },
    }));
    return attr.id;
  },

  updateAttribute: (entityId, attrId, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                attributes: e.attributes.map((a) =>
                  a.id === attrId ? { ...a, ...patch } : a
                ),
              }
            : e
        ),
      },
    }));
  },

  deleteAttribute: (entityId, attrId) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                attributes: e.attributes.filter((a) => a.id !== attrId),
                candidateKeys: e.candidateKeys.map((ck) => ({
                  ...ck,
                  attributeIds: ck.attributeIds.filter((id) => id !== attrId),
                })),
              }
            : e
        ),
      },
      selection:
        state.selection &&
        state.selection.type === 'attribute' &&
        state.selection.attributeId === attrId
          ? null
          : state.selection,
    }));
  },

  // ---- Relationship attribute actions ----

  addRelationshipAttribute: (relId, name, dataType) => {
    const attr = createAttribute(name, dataType);
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.map((r) =>
          r.id === relId
            ? { ...r, attributes: [...r.attributes, attr] }
            : r
        ),
      },
    }));
    return attr.id;
  },

  updateRelationshipAttribute: (relId, attrId, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.map((r) =>
          r.id === relId
            ? {
                ...r,
                attributes: r.attributes.map((a) =>
                  a.id === attrId ? { ...a, ...patch } : a
                ),
              }
            : r
        ),
      },
    }));
  },

  deleteRelationshipAttribute: (relId, attrId) => {
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.map((r) =>
          r.id === relId
            ? { ...r, attributes: r.attributes.filter((a) => a.id !== attrId) }
            : r
        ),
      },
      selection:
        state.selection &&
        state.selection.type === 'relAttribute' &&
        state.selection.attributeId === attrId
          ? null
          : state.selection,
    }));
  },

  // ---- Candidate Key actions ----

  addCandidateKey: (entityId, name, attributeIds, isPrimary) => {
    const id = generateId();
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) => {
          if (e.id !== entityId) return e;
          const updatedKeys = isPrimary
            ? e.candidateKeys.map((ck) => ({ ...ck, isPrimary: false }))
            : [...e.candidateKeys];
          return {
            ...e,
            candidateKeys: [
              ...updatedKeys,
              { id, name, attributeIds, isPrimary } as CandidateKey,
            ],
          };
        }),
      },
    }));
    return id;
  },

  updateCandidateKey: (entityId, keyId, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                candidateKeys: e.candidateKeys.map((ck) =>
                  ck.id === keyId ? { ...ck, ...patch } : ck
                ),
              }
            : e
        ),
      },
    }));
  },

  deleteCandidateKey: (entityId, keyId) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                candidateKeys: e.candidateKeys.filter((ck) => ck.id !== keyId),
              }
            : e
        ),
      },
    }));
  },

  setPrimaryKey: (entityId, keyId) => {
    set((state) => ({
      model: {
        ...state.model,
        entities: state.model.entities.map((e) =>
          e.id === entityId
            ? {
                ...e,
                candidateKeys: e.candidateKeys.map((ck) => ({
                  ...ck,
                  isPrimary: ck.id === keyId,
                })),
              }
            : e
        ),
      },
    }));
  },

  // ---- Relationship actions ----

  addRelationship: (name, participants, position) => {
    const id = generateId();
    const relationship: Relationship = {
      id,
      name,
      participants,
      isIdentifying: false,
      attributes: [],
      position,
    };
    set((state) => ({
      model: {
        ...state.model,
        relationships: [...state.model.relationships, relationship],
      },
    }));
    return id;
  },

  updateRelationship: (id, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.map((r) =>
          r.id === id ? { ...r, ...patch } : r
        ),
      },
    }));
  },

  updateParticipant: (relId, index, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.map((r) =>
          r.id === relId
            ? {
                ...r,
                participants: r.participants.map((p, i) =>
                  i === index ? { ...p, ...patch } : p
                ),
              }
            : r
        ),
      },
    }));
  },

  deleteRelationship: (id) => {
    set((state) => ({
      model: {
        ...state.model,
        relationships: state.model.relationships.filter((r) => r.id !== id),
        aggregations: state.model.aggregations.filter((a) => a.relationshipId !== id),
      },
      selection:
        state.selection &&
        state.selection.type === 'relationship' &&
        state.selection.relationshipId === id
          ? null
          : state.selection,
    }));
  },

  // ---- Aggregation actions ----

  addAggregation: (name, relationshipId) => {
    const id = generateId();
    const aggregation: Aggregation = { id, name, relationshipId };
    set((state) => ({
      model: {
        ...state.model,
        aggregations: [...state.model.aggregations, aggregation],
      },
    }));
    return id;
  },

  updateAggregation: (id, patch) => {
    set((state) => ({
      model: {
        ...state.model,
        aggregations: state.model.aggregations.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      },
    }));
  },

  deleteAggregation: (id) => {
    set((state) => ({
      model: {
        ...state.model,
        aggregations: state.model.aggregations.filter((a) => a.id !== id),
        // Remove any relationships that reference this aggregation as a participant
        relationships: state.model.relationships.map((r) => ({
          ...r,
          participants: r.participants.filter(
            (p) => !(p.isAggregation && p.entityId === id)
          ),
        })),
      },
      selection:
        state.selection &&
        state.selection.type === 'aggregation' &&
        state.selection.aggregationId === id
          ? null
          : state.selection,
    }));
  },

  // ---- Node position tracking ----

  setNodePosition: (nodeId, position) => {
    set((state) => ({
      nodePositions: { ...state.nodePositions, [nodeId]: position },
    }));
  },

  // ---- UI actions ----

  setNotation: (notation) => set({ notation }),

  setSelection: (selection) => set({ selection }),

  loadModel: (model) => set({ model, selection: null, nodePositions: {} }),

  clearModel: () => set({ model: { ...emptyModel }, selection: null, nodePositions: {} }),
}));
