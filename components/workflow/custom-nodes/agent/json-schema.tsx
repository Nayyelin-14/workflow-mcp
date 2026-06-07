import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputList,
} from "@/components/ui/tags-input";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface FieldConfig {
  type?: string;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
}

interface JsonSchemaProps {
  schema: Record<string, unknown>;
  onChange: (schema: Record<string, unknown>) => void;
}

const SchemaType = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  ENUM: "enum",
} as const;

const TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  number: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  boolean: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  enum: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

interface FieldState {
  name: string;
  type: string;
  description: string;
  enumValues: string;
}

export function JsonSchema({ schema, onChange }: JsonSchemaProps) {
  const properties = (schema?.properties as Record<string, FieldConfig>) || {};
  const [fields, setFields] = useState<FieldState[]>(
    Object.entries(properties).map(([name, config]) => ({
      name,
      type: config.enum ? "enum" : (config.type ?? "string"),
      description: config.description || "",
      enumValues: config.enum?.join(", ") || "",
    })),
  );

  const updateSchema = (newFields: FieldState[]) => {
    const props: Record<string, FieldConfig> = {};
    newFields.forEach((f) => {
      if (!f.name) return;
      const field: FieldConfig = {
        type: f.type === "enum" ? "string" : f.type,
        description: f.description || undefined,
        default: f.type === "number" ? 0 : f.type === "boolean" ? false : "",
      };
      if (f.type === "enum" && f.enumValues) {
        field.enum = f.enumValues.split(",").map((v: string) => v.trim());
      }
      props[f.name] = field;
    });
    onChange({ type: "object", title: "response_schema", properties: props });
  };

  const addField = () => {
    const newFields = [
      ...fields,
      { name: "", type: "string", description: "", enumValues: "" },
    ];
    setFields(newFields);
  };

  const updateField = (index: number, key: string, value: string) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
    updateSchema(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    updateSchema(newFields);
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-dashed border-border text-muted-foreground">
          <p className="text-xs">No fields yet</p>
          <p className="text-xs opacity-60">Click below to add one</p>
        </div>
      )}

      {fields.map((field, i) => (
        <div
          key={i}
          className="group rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors duration-150"
        >
          {/* Header row */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
            {/* Index badge */}
            <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-semibold bg-muted text-muted-foreground">
              {i + 1}
            </span>

            {/* Name */}
            <Input
              value={field.name}
              onChange={(e) => updateField(i, "name", e.target.value)}
              placeholder="field_name"
              className="h-7 text-xs font-mono flex-1 bg-background border-border focus-visible:ring-1"
            />

            {/* Type badge select */}
            <Select
              value={field.type}
              onValueChange={(v) => updateField(i, "type", v)}
            >
              <SelectTrigger
                className={`h-7 text-xs w-24 border font-medium px-2 ${TYPE_COLORS[field.type] || ""}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SchemaType.STRING}>
                  <span className="text-blue-500 font-medium">string</span>
                </SelectItem>
                <SelectItem value={SchemaType.NUMBER}>
                  <span className="text-amber-500 font-medium">number</span>
                </SelectItem>
                <SelectItem value={SchemaType.BOOLEAN}>
                  <span className="text-emerald-500 font-medium">boolean</span>
                </SelectItem>
                <SelectItem value={SchemaType.ENUM}>
                  <span className="text-violet-500 font-medium">enum</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Delete */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeField(i)}
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Description row */}
          <div className="px-3 pb-2.5">
            <Textarea
              value={field.description}
              onChange={(e) => updateField(i, "description", e.target.value)}
              rows={1}
              placeholder="Optional description..."
              className="text-xs resize-none bg-background border-border focus-visible:ring-1 min-h-0 py-1.5"
            />
          </div>

          {/* Enum values */}
          {field.type === SchemaType.ENUM && (
            <div className="px-3 pb-3 space-y-1.5 border-t border-border pt-2">
              <Label className="text-xs text-muted-foreground font-normal">
                Enum values
              </Label>
              <TagsInput
                value={field.enumValues
                  .split(",")
                  .map((v: string) => v.trim())
                  .filter(Boolean)}
                onValueChange={(values: string[]) =>
                  updateField(i, "enumValues", values.join(", "))
                }
              >
                <TagsInputList className="bg-background rounded-md border border-border px-2 py-1 flex-wrap gap-1 min-h-8">
                  {field.enumValues
                    .split(",")
                    .map((v: string) => v.trim())
                    .filter(Boolean)
                    .map((value: string) => (
                      <TagsInputItem
                        className="bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-full text-xs px-2 py-0"
                        key={value}
                        value={value}
                      >
                        {value}
                      </TagsInputItem>
                    ))}
                  <TagsInputInput
                    placeholder="Add value, press enter..."
                    className="text-xs h-6 min-w-24 border-none outline-none bg-transparent"
                  />
                </TagsInputList>
              </TagsInput>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addField}
        className="w-full h-8 text-xs border-dashed text-muted-foreground hover:text-foreground gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Field
      </Button>
    </div>
  );
}
