import { Request, Response, NextFunction } from 'express';

type PrimitiveType = 'string' | 'number' | 'boolean';

type FieldRule = {
  required?: boolean;
  type?: PrimitiveType;
  minLength?: number;
  maxLength?: number;
  allowEmpty?: boolean;
};

type Schema = Record<string, FieldRule>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getType(value: unknown): PrimitiveType | 'other' {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'other';
}

export function validateBody(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isObject(req.body)) {
      return res.status(400).json({ error: 'Body inválido' });
    }

    for (const [field, rule] of Object.entries(schema)) {
      const value = req.body[field];

      if (value === undefined || value === null) {
        if (rule.required) {
          return res.status(400).json({ error: `Campo requerido: ${field}` });
        }
        continue;
      }

      if (rule.type && getType(value) !== rule.type) {
        return res.status(400).json({ error: `Tipo inválido para ${field}` });
      }

      if (rule.type === 'string') {
        const raw = String(value);
        const trimmed = raw.trim();
        req.body[field] = trimmed;

        if (!rule.allowEmpty && trimmed.length === 0) {
          return res.status(400).json({ error: `Campo vacío no permitido: ${field}` });
        }
        if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
          return res.status(400).json({ error: `${field} debe tener al menos ${rule.minLength} caracteres` });
        }
        if (rule.maxLength !== undefined && trimmed.length > rule.maxLength) {
          return res.status(400).json({ error: `${field} excede el máximo de ${rule.maxLength} caracteres` });
        }
      }
    }

    next();
  };
}

export function validateNumericIdParam(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params[paramName]);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: `Parámetro inválido: ${paramName}` });
    }
    next();
  };
}
