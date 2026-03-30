import type { ExportResult, Exporter } from './types';
import type { ERDModel, Entity, Relationship, Attribute, DataType, CandidateKey, Participant } from '../ir/types';
import { isMany, fkColumnName } from '../utils/cardinality';

interface FKConstraint {
  tableName: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
}

interface TableDef {
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
  primaryKey: string[];
  uniqueConstraints: string[][];
  foreignKeys: FKConstraint[];
  isJunction?: boolean;
}

export abstract class BaseExporter implements Exporter {
  abstract readonly dialect: string;
  abstract quoteIdentifier(name: string): string;
  abstract mapDataType(dt: DataType): string;

  /**
   * Resolve a participant to real entities. If the participant references an
   * aggregation, returns the entities involved in the aggregated relationship.
   */
  protected resolveParticipantEntities(p: Participant, model: ERDModel): Entity[] {
    if (p.isAggregation) {
      const agg = model.aggregations.find((a) => a.id === p.entityId);
      if (!agg) return [];
      const rel = model.relationships.find((r) => r.id === agg.relationshipId);
      if (!rel) return [];
      return rel.participants
        .filter((rp) => !rp.isAggregation)
        .map((rp) => model.entities.find((e) => e.id === rp.entityId))
        .filter((e): e is Entity => e != null);
    }
    const entity = model.entities.find((e) => e.id === p.entityId);
    return entity ? [entity] : [];
  }

  export(model: ERDModel): ExportResult {
    const warnings: string[] = [];
    const tables: TableDef[] = [];

    // Build tables from entities
    for (const entity of model.entities) {
      const table = this.buildEntityTable(entity, model, warnings);
      tables.push(table);

      // Handle multivalued attributes
      for (const attr of entity.attributes) {
        if (attr.kind === 'multivalued') {
          tables.push(this.buildMultivaluedTable(entity, attr, warnings));
        }
      }
    }

    // Handle M:N relationships (junction tables)
    for (const rel of model.relationships) {
      if (rel.participants.length < 2) {
        warnings.push(`Relationship "${rel.name}" has fewer than 2 participants`);
        continue;
      }
      if (rel.isIdentifying) continue; // Already handled in weak entity logic
      if (this.isManyToMany(rel)) {
        tables.push(this.buildJunctionTable(rel, model, warnings));
      } else {
        // 1:N or 1:1 → add FK to appropriate table
        this.addRelationshipFKs(rel, model, tables, warnings);
      }
    }

    // Add relationship attributes to the correct table
    for (const rel of model.relationships) {
      if (rel.attributes.length === 0) continue;
      if (rel.participants.length < 2) continue;
      if (rel.isIdentifying) continue;

      for (const attr of rel.attributes) {
        if (attr.kind === 'derived') {
          warnings.push(`Derived attribute "${attr.name}" on relationship "${rel.name}" skipped`);
          continue;
        }

        if (this.isManyToMany(rel)) {
          // Add to junction table
          const e1 = model.entities.find((e) => e.id === rel.participants[0].entityId);
          const e2 = model.entities.find((e) => e.id === rel.participants[1].entityId);
          if (e1 && e2) {
            const jName = rel.name;
            const jTable = tables.find((t) => t.name === jName);
            if (jTable) {
              jTable.columns.push({
                name: attr.name,
                type: this.mapDataType(attr.dataType),
                nullable: attr.nullable,
              });
            }
          }
        } else {
          // Add to the FK side table
          const fkSideEntity = this.getFKSideEntity(rel, model);
          if (fkSideEntity) {
            const table = tables.find((t) => t.name === fkSideEntity.name);
            if (table) {
              table.columns.push({
                name: attr.name,
                type: this.mapDataType(attr.dataType),
                nullable: attr.nullable,
              });
            }
          }
        }
      }
    }

    // Topological sort
    const sorted = this.topologicalSort(tables);

    // Check for cycles
    const hasCycles = sorted.length < tables.length;
    const deferredFKs: FKConstraint[] = [];

    if (hasCycles) {
      // Move FK constraints to ALTER TABLE statements
      const sortedNames = new Set(sorted.map((t) => t.name));
      for (const table of tables) {
        if (!sortedNames.has(table.name)) {
          sorted.push(table);
          deferredFKs.push(...table.foreignKeys);
          table.foreignKeys = [];
        }
      }
    }

    // Generate DDL
    const ddlParts: string[] = [];

    for (const table of sorted) {
      ddlParts.push(this.generateCreateTable(table));
    }

    for (const fk of deferredFKs) {
      ddlParts.push(this.generateAlterTableFK(fk));
    }

    return {
      ddl: ddlParts.join('\n\n'),
      warnings,
    };
  }

  private buildEntityTable(entity: Entity, model: ERDModel, warnings: string[]): TableDef {
    const columns: TableDef['columns'] = [];
    const primaryKey: string[] = [];
    const uniqueConstraints: string[][] = [];
    const foreignKeys: FKConstraint[] = [];

    if (entity.attributes.length === 0) {
      warnings.push(`Entity "${entity.name}" has no attributes`);
    }

    // Process attributes
    for (const attr of entity.attributes) {
      if (attr.kind === 'derived') {
        warnings.push(`Derived attribute "${attr.name}" on entity "${entity.name}" skipped`);
        continue;
      }
      if (attr.kind === 'multivalued') {
        // Handled separately as its own table
        continue;
      }
      if (attr.kind === 'composite') {
        // Flatten: use child attributes if they exist
        const children = attr.childAttributeIds
          .map((id) => entity.attributes.find((a) => a.id === id))
          .filter((a): a is Attribute => a != null);
        if (children.length === 0) {
          warnings.push(`Composite attribute "${attr.name}" on entity "${entity.name}" has no children`);
          // Still add it as a column
          columns.push({
            name: attr.name,
            type: this.mapDataType(attr.dataType),
            nullable: attr.nullable,
          });
        }
        // Children are added as their own regular columns in the loop
        continue;
      }

      columns.push({
        name: attr.name,
        type: this.mapDataType(attr.dataType),
        nullable: attr.nullable,
      });
    }

    // Process candidate keys
    const pk = entity.candidateKeys.find((ck) => ck.isPrimary);
    if (pk) {
      for (const attrId of pk.attributeIds) {
        const attr = entity.attributes.find((a) => a.id === attrId);
        if (attr) {
          primaryKey.push(attr.name);
        }
      }
    } else {
      warnings.push(`Entity "${entity.name}" has no primary key`);
    }

    for (const ck of entity.candidateKeys) {
      if (ck.isPrimary) continue;
      const attrs = ck.attributeIds
        .map((id) => entity.attributes.find((a) => a.id === id)?.name)
        .filter((n): n is string => n != null);
      if (attrs.length > 0) {
        uniqueConstraints.push(attrs);
      }
    }

    // Handle identifying relationships (weak entities)
    if (entity.isWeak) {
      const identRel = model.relationships.find(
        (r) => r.isIdentifying && r.participants.some((p) => p.entityId === entity.id)
      );
      if (identRel) {
        const ownerParticipant = identRel.participants.find((p) => p.entityId !== entity.id);
        const owner = ownerParticipant ? model.entities.find((e) => e.id === ownerParticipant.entityId) : null;
        if (owner) {
          const ownerPk = owner.candidateKeys.find((ck) => ck.isPrimary);
          if (ownerPk) {
            for (const attrId of ownerPk.attributeIds) {
              const attr = owner.attributes.find((a) => a.id === attrId);
              if (attr) {
                const fkColName = fkColumnName(owner.name, attr.name);
                columns.push({
                  name: fkColName,
                  type: this.mapDataType(attr.dataType),
                  nullable: false,
                });
                primaryKey.push(fkColName);
              }
            }
            foreignKeys.push({
              tableName: entity.name,
              columns: ownerPk.attributeIds
                .map((id) => owner.attributes.find((a) => a.id === id))
                .filter((a): a is Attribute => a != null)
                .map((a) => fkColumnName(owner.name, a.name)),
              refTable: owner.name,
              refColumns: ownerPk.attributeIds
                .map((id) => owner.attributes.find((a) => a.id === id)?.name)
                .filter((n): n is string => n != null),
            });
          }
        }
      } else {
        warnings.push(`Weak entity "${entity.name}" has no identifying relationship`);
      }
    }

    return { name: entity.name, columns, primaryKey, uniqueConstraints, foreignKeys };
  }

  private buildMultivaluedTable(entity: Entity, attr: Attribute, _warnings: string[]): TableDef {
    const tableName = `${entity.name}_${attr.name}`;
    const pk = entity.candidateKeys.find((ck) => ck.isPrimary);

    const columns: TableDef['columns'] = [];
    const pkCols: string[] = [];
    const fkCols: string[] = [];
    const refCols: string[] = [];

    // FK to parent entity
    if (pk) {
      for (const attrId of pk.attributeIds) {
        const pkAttr = entity.attributes.find((a) => a.id === attrId);
        if (pkAttr) {
          const colName = fkColumnName(entity.name, pkAttr.name);
          columns.push({ name: colName, type: this.mapDataType(pkAttr.dataType), nullable: false });
          pkCols.push(colName);
          fkCols.push(colName);
          refCols.push(pkAttr.name);
        }
      }
    }

    // The value column
    columns.push({ name: attr.name, type: this.mapDataType(attr.dataType), nullable: false });
    pkCols.push(attr.name);

    return {
      name: tableName,
      columns,
      primaryKey: pkCols,
      uniqueConstraints: [],
      foreignKeys: [{
        tableName,
        columns: fkCols,
        refTable: entity.name,
        refColumns: refCols,
      }],
    };
  }

  private isManyToMany(rel: Relationship): boolean {
    if (rel.participants.length < 2) return false;
    return isMany(rel.participants[0].cardinality) && isMany(rel.participants[1].cardinality);
  }

  private buildJunctionTable(rel: Relationship, model: ERDModel, _warnings: string[]): TableDef {
    const e1 = model.entities.find((e) => e.id === rel.participants[0].entityId);
    const e2 = model.entities.find((e) => e.id === rel.participants[1].entityId);
    if (!e1 || !e2) return { name: rel.name, columns: [], primaryKey: [], uniqueConstraints: [], foreignKeys: [] };

    const tableName = rel.name;
    const columns: TableDef['columns'] = [];
    const pkCols: string[] = [];
    const foreignKeys: FKConstraint[] = [];

    // Detect FK column name collisions across both entities
    const allAttrNames: string[] = [];
    for (const entity of [e1, e2]) {
      const pk = entity.candidateKeys.find((ck) => ck.isPrimary);
      if (!pk) continue;
      for (const attrId of pk.attributeIds) {
        const attr = entity.attributes.find((a) => a.id === attrId);
        if (attr) allAttrNames.push(attr.name);
      }
    }
    const hasCollision = new Set(allAttrNames).size < allAttrNames.length;

    for (const entity of [e1, e2]) {
      const pk = entity.candidateKeys.find((ck) => ck.isPrimary);
      if (!pk) continue;

      const fkCols: string[] = [];
      const refCols: string[] = [];

      for (const attrId of pk.attributeIds) {
        const attr = entity.attributes.find((a) => a.id === attrId);
        if (attr) {
          const colName = hasCollision
            ? `${entity.name.toLowerCase()}_${attr.name}`
            : fkColumnName(entity.name, attr.name);
          columns.push({ name: colName, type: this.mapDataType(attr.dataType), nullable: false });
          pkCols.push(colName);
          fkCols.push(colName);
          refCols.push(attr.name);
        }
      }

      foreignKeys.push({
        tableName,
        columns: fkCols,
        refTable: entity.name,
        refColumns: refCols,
      });
    }

    return { name: tableName, columns, primaryKey: pkCols, uniqueConstraints: [], foreignKeys, isJunction: true };
  }

  private getFKSideEntity(rel: Relationship, model: ERDModel): Entity | null {
    if (rel.participants.length < 2) return null;
    const p0 = rel.participants[0];
    const p1 = rel.participants[1];

    const isMany0 = isMany(p0.cardinality);
    const isMany1 = isMany(p1.cardinality);

    // 1:N → many side gets FK
    if (isMany0 && !isMany1) {
      return model.entities.find((e) => e.id === p0.entityId) ?? null;
    }
    if (isMany1 && !isMany0) {
      return model.entities.find((e) => e.id === p1.entityId) ?? null;
    }

    // 1:1 → optional side or alphabetically first
    const e0 = model.entities.find((e) => e.id === p0.entityId);
    const e1 = model.entities.find((e) => e.id === p1.entityId);
    if (!e0 || !e1) return null;

    if (p0.cardinality.min === 0 && p1.cardinality.min !== 0) return e0;
    if (p1.cardinality.min === 0 && p0.cardinality.min !== 0) return e1;
    return e0.name > e1.name ? e0 : e1;
  }

  private addRelationshipFKs(rel: Relationship, model: ERDModel, tables: TableDef[], warnings: string[]) {
    if (rel.participants.length < 2) return;
    if (rel.isIdentifying) return; // Already handled in weak entity logic

    const fkEntity = this.getFKSideEntity(rel, model);
    if (!fkEntity) return;

    const fkTable = tables.find((t) => t.name === fkEntity.name);
    if (!fkTable) return;

    // Find the other entity (the one referenced)
    const otherParticipant = rel.participants.find((p) => p.entityId !== fkEntity.id);
    if (!otherParticipant) {
      // Self-referencing: use second participant
      if (rel.participants[0].entityId === rel.participants[1].entityId) {
        const entity = model.entities.find((e) => e.id === fkEntity.id);
        if (!entity) return;
        const pk = entity.candidateKeys.find((ck) => ck.isPrimary);
        if (!pk) return;

        const fkCols: string[] = [];
        const refCols: string[] = [];

        for (const attrId of pk.attributeIds) {
          const attr = entity.attributes.find((a) => a.id === attrId);
          if (attr) {
            const colName = `ref_${attr.name}`;
            fkTable.columns.push({ name: colName, type: this.mapDataType(attr.dataType), nullable: true });
            fkCols.push(colName);
            refCols.push(attr.name);
          }
        }

        fkTable.foreignKeys.push({
          tableName: fkEntity.name,
          columns: fkCols,
          refTable: fkEntity.name,
          refColumns: refCols,
        });
        return;
      }
      return;
    }

    const refEntity = model.entities.find((e) => e.id === otherParticipant.entityId);
    if (!refEntity) return;

    const refPk = refEntity.candidateKeys.find((ck) => ck.isPrimary);
    if (!refPk) {
      warnings.push(`Cannot create FK for relationship "${rel.name}": referenced entity "${refEntity.name}" has no primary key`);
      return;
    }

    const fkCols: string[] = [];
    const refCols: string[] = [];

    for (const attrId of refPk.attributeIds) {
      const attr = refEntity.attributes.find((a) => a.id === attrId);
      if (attr) {
        const colName = fkColumnName(refEntity.name, attr.name);
        // Avoid duplicate columns
        if (!fkTable.columns.some((c) => c.name === colName)) {
          fkTable.columns.push({ name: colName, type: this.mapDataType(attr.dataType), nullable: true });
        }
        fkCols.push(colName);
        refCols.push(attr.name);
      }
    }

    fkTable.foreignKeys.push({
      tableName: fkEntity.name,
      columns: fkCols,
      refTable: refEntity.name,
      refColumns: refCols,
    });
  }

  private topologicalSort(tables: TableDef[]): TableDef[] {
    const nameToTable = new Map(tables.map((t) => [t.name, t]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: TableDef[] = [];
    let hasCycle = false;

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) { hasCycle = true; return; }
      visiting.add(name);

      const table = nameToTable.get(name);
      if (table) {
        for (const fk of table.foreignKeys) {
          if (fk.refTable !== name) { // Skip self-references
            visit(fk.refTable);
          }
        }
        visiting.delete(name);
        visited.add(name);
        sorted.push(table);
      }
    };

    for (const table of tables) {
      if (!visited.has(table.name)) {
        visit(table.name);
      }
    }

    if (hasCycle) {
      // Return what we have; caller handles deferred FKs
      return sorted;
    }

    return sorted;
  }

  private generateCreateTable(table: TableDef): string {
    const q = (n: string) => this.quoteIdentifier(n);
    const lines: string[] = [];

    for (const col of table.columns) {
      const parts = [q(col.name), col.type];
      if (!col.nullable) parts.push('NOT NULL');
      lines.push(`  ${parts.join(' ')}`);
    }

    if (table.primaryKey.length > 0) {
      lines.push(`  PRIMARY KEY (${table.primaryKey.map(q).join(', ')})`);
    }

    for (const uq of table.uniqueConstraints) {
      lines.push(`  UNIQUE (${uq.map(q).join(', ')})`);
    }

    for (const fk of table.foreignKeys) {
      lines.push(
        `  FOREIGN KEY (${fk.columns.map(q).join(', ')}) REFERENCES ${q(fk.refTable)} (${fk.refColumns.map(q).join(', ')})`
      );
    }

    return `CREATE TABLE ${q(table.name)} (\n${lines.join(',\n')}\n);`;
  }

  private generateAlterTableFK(fk: FKConstraint): string {
    const q = (n: string) => this.quoteIdentifier(n);
    return `ALTER TABLE ${q(fk.tableName)} ADD FOREIGN KEY (${fk.columns.map(q).join(', ')}) REFERENCES ${q(fk.refTable)} (${fk.refColumns.map(q).join(', ')});`;
  }
}
