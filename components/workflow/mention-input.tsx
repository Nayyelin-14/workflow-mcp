import { cn } from "@/lib/utils";
import { Mention, MentionsInput } from "react-mentions";
import type { MentionsInputStyle } from "react-mentions";
import { Command, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { BracesIcon } from "lucide-react";
import { useWorkflow } from "@/context/workflow-context";
import { useMemo, useState } from "react";

type suggestionType = {
  id: string;
  display: string;
};

type PROPS = {
  nodeId: string;
  value: string;
  placeholder?: string;
  classname?: string;
  showTriggerButton?: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;

  onBlur?: () => void;
};

const MentionInput = ({
  nodeId,
  value,
  placeholder,
  classname,
  showTriggerButton,
  onChange,
  multiline,
  onBlur,
}: PROPS) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { getVariablesForNode } = useWorkflow();
  const suggestions = useMemo(() => {
    if (!nodeId) return [];
    const availableNodes = getVariablesForNode(nodeId);
    const result: suggestionType[] = [];
    availableNodes.forEach((node) => {
      const nodeLabel = (node?.label as string)
        ?.toLowerCase()
        ?.replace(/ /g, "_");
      node.outputs?.forEach((output: string) => {
        result.push({
          id: `${node.id}.${output}`,
          display: `${nodeLabel}.${output}`,
        });
      });
    });
    return result;
  }, [nodeId, getVariablesForNode]);

  const mentionInputStyle = useMemo<MentionsInputStyle>(
    () => ({
      control: {
        fontSize: 14,
        lineHeight: "1.5rem",
        position: "relative",
        overflow: "visible",
      },
      highlighter: {
        padding: "0.5rem 0.75rem",
        border: "1px solid transparent",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        pointerEvents: "none",
        overflow: "hidden",
        maxHeight: multiline ? 200 : undefined,
      },
      input: {
        padding: "0.5rem 0.75rem",
        minHeight: multiline ? "80px" : "auto",
        maxHeight: multiline ? 200 : undefined,
        resize: multiline ? ("vertical" as const) : ("none" as const),
        overflow: multiline ? "auto" : "hidden",
        border: "none",
        outline: "none",
        backgroundColor: "transparent",
        color: "inherit",
        position: "relative",
        zIndex: 1,
      },
      suggestions: {
        list: { maxHeight: 200, overflow: "auto" },
        item: {
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid hsl(var(--border))",
          "&focused": { backgroundColor: "hsl(var(--accent))" },
        },
      },
    }),
    [multiline],
  );
  return (
    <div
      className={cn(
        `relative w-full rounded-md border text-sm bg-background text-foreground border-input `,
        classname,
      )}
    >
      <MentionsInput
        value={value}
        style={mentionInputStyle}
        placeholder={placeholder}
        singleLine={!multiline}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        customSuggestionsContainer={(children) => (
          <div className="fixed bg-popover z-999 min-w-64 max-w-2xl  rounded-lg border shadow-lg right-10! ">
            <Command>
              <CommandList className="max-h-64 overflow-y-auto ">
                {children}
              </CommandList>
            </Command>
          </div>
        )}
      >
        <Mention
          trigger="{{"
          data={suggestions}
          markup="{{__id__}}"
          displayTransform={(id) => `{{${id}}}`}
          appendSpaceOnAdd
          className="bg-primary/20"
          renderSuggestion={(
            entry,
            _searchm,
            _highlighted,
            _index,
            focused,
          ) => {
            return (
              <CommandItem
                value={entry.display}
                className={cn(
                  `flex justify-between  text-sm cursor-pointer hover:bg-black/10`,
                  focused && "bg-red-500 text-accent-foreground",
                )}
              >
                <div className="flex flex-1 items-start gap-2">
                  <span className="truncate">{entry.display}</span>
                </div>
              </CommandItem>
            );
          }}
        />
      </MentionsInput>

      {showTriggerButton && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "absolute h-6 w-6 z-10",
                multiline
                  ? "right-2 bottom-2"
                  : "right-2 top-1/2 -translate-y-1/2",
              )}
            >
              <BracesIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="min-w-64 p-0"
            align="end"
            side="bottom"
            sideOffset={4}
          >
            <Command className="space-y-2">
              <CommandInput placeholder="Search for variable..." />
              <CommandList className="max-h-64 overflow-y-auto">
                {Array.isArray(suggestions) &&
                  suggestions.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.display}
                      className="text-sm"
                      onSelect={() => {
                        onChange(value + `{{${item.id}}}`);
                        setPopoverOpen(false);
                      }}
                    >
                      <div className="flex flex-1 items-start gap-2">
                        <span className="truncate">{item.display}</span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default MentionInput;
