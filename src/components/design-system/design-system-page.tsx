"use client";

import { Download, Filter, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Row, Section, TokenCard, TokenGrid } from "@/components/design-system/gallery-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, ChipDot } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FormField } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, MultiSelect } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ListboxOption } from "@/components/ui/listbox";
import { SELECT_COLORS } from "@/lib/board-schema";
import { EmptyState } from "@/components/drive/empty-state";
import { ErrorState } from "@/components/shared/state-panels";

const STATUS_OPTIONS: readonly ListboxOption[] = [
  { value: "todo", label: "Todo", color: "gray" },
  { value: "doing", label: "Doing", color: "blue" },
  { value: "review", label: "Review", color: "amber" },
  {
    value: "done",
    label: "Done",
    color: "green",
    isDisabled: true,
    disabledReason: "QA Status must be Passed first",
  },
];

const PEOPLE_OPTIONS: readonly ListboxOption[] = [
  { value: "thanh", label: "Thanh Nguyen", description: "thanh@nexdrop.vn" },
  { value: "nam", label: "Nam Tran", description: "nam@nexdrop.vn" },
  { value: "minh", label: "Minh Le", description: "minh@nexdrop.vn" },
];

const TYPE_STEPS = [
  ["text-display", "18px", "Page title"],
  ["text-title", "15px", "Dialog + section title"],
  ["text-lead", "13px", "List and tree rows"],
  ["text-ui", "12px", "Form controls, menus"],
  ["text-body", "11px", "The workspace default"],
  ["text-micro", "10px", "Metadata, counts"],
] as const;

const LAYERS = [
  ["z-base", "0"],
  ["z-raised", "10"],
  ["z-sticky", "20"],
  ["z-sticky-header", "25"],
  ["z-overlay", "30"],
  ["z-modal", "40"],
  ["z-dropdown", "50"],
  ["z-toast", "60"],
  ["z-tooltip", "70"],
] as const;

export function DesignSystemPage() {
  const [status, setStatus] = useState<string | null>("doing");
  const [people, setPeople] = useState<readonly string[]>(["thanh"]);
  const [owner, setOwner] = useState<string | null>(null);
  const [isOn, setIsOn] = useState(true);
  const [isChecked, setIsChecked] = useState(true);
  const [access, setAccess] = useState("inherit");
  const [density, setDensity] = useState("comfortable");
  const [tab, setTab] = useState("overview");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState<string | null>("2026-08-27");
  const [start, setStart] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <header>
          <h1 className="text-display font-semibold tracking-tight text-foreground">
            Design system
          </h1>
          <p className="mt-1.5 max-w-2xl text-ui text-muted-foreground">
            Every control the workspace is built from. Before writing a new one, look here —
            and if what you need is close but not quite right, widen the primitive rather
            than writing a sixth version of it beside the five that already exist.
          </p>
        </header>

        <Section
          id="typography"
          title="Typography"
          summary="Six steps, ratified from what the app already wrote: 10, 11, 12 and 13px carried 84% of every string on screen. Each carries its own line height, so a size is never half a decision."
        >
          <div className="space-y-1.5 rounded-lg border border-hairline bg-surface p-4">
            {TYPE_STEPS.map(([token, size, use]) => (
              <div key={token} className="flex flex-wrap items-baseline gap-3">
                <span className={`${token} min-w-40 text-foreground`}>The quick brown fox</span>
                <span className="metric text-micro text-faint-foreground">
                  {token} · {size} · {use}
                </span>
              </div>
            ))}
            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <span className="metric min-w-40 text-code text-foreground">
                const answer = 42;
              </span>
              <span className="metric text-micro text-faint-foreground">
                text-code · 12.5px · monospace surfaces
              </span>
            </div>
          </div>
        </Section>

        <Section
          id="colour"
          title="Colour"
          summary="Semantic only. Every token is re-declared under .dark, which is why there is not a single `dark:` variant anywhere in the app — and why a hex literal in a component is a bug rather than a shortcut."
        >
          <TokenGrid>
            {[
              ["background", "bg-background"],
              ["canvas", "bg-canvas"],
              ["surface", "bg-surface"],
              ["elevated", "bg-elevated"],
              ["border", "bg-border"],
              ["accent", "bg-accent"],
              ["success", "bg-success"],
              ["warning", "bg-warning"],
              ["danger", "bg-danger"],
            ].map(([name, cls]) => (
              <TokenCard key={name} name={`--${name ?? ""}`} value={cls ?? ""}>
                <div className={`h-10 rounded-md border border-hairline ${cls ?? ""}`} />
              </TokenCard>
            ))}
          </TokenGrid>
        </Section>

        <Section
          id="layering"
          title="Layering and elevation"
          summary="Eleven surfaces used to claim z-50 and settle their order by DOM accident. Dropdown deliberately outranks modal: a menu is always opened from something, so it has to paint over it."
        >
          <div className="flex flex-wrap gap-1.5">
            {LAYERS.map(([token, value]) => (
              <span
                key={token}
                className="metric rounded-md border border-hairline bg-surface px-2 py-1 text-micro text-muted-foreground"
              >
                {token} <span className="text-faint-foreground">{value}</span>
              </span>
            ))}
          </div>
          <Row label="Elevation" note="tinted, not black">
            {["shadow-raise", "shadow-pop", "shadow-float"].map((cls) => (
              <div
                key={cls}
                className={`metric rounded-lg border border-hairline bg-elevated px-3 py-2 text-micro text-muted-foreground ${cls}`}
              >
                {cls}
              </div>
            ))}
          </Row>
        </Section>

        <Section
          id="button"
          title="Button"
          summary="One control, six intents. A module that styles its own button is a module whose buttons will drift from everyone else's within a week."
        >
          <Row label="Variant">
            <Button variant="default">Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Size" note="24 / 28 / 32 / 36px">
            <Button variant="outline" size="xs">Extra small</Button>
            <Button variant="outline" size="sm">Small</Button>
            <Button variant="outline" size="md">Medium</Button>
            <Button variant="outline" size="lg">Large</Button>
          </Row>
          <Row label="State">
            <Button variant="default">
              <Download />
              Export
            </Button>
            <Button variant="default" isLoading>
              <Download />
              Export
            </Button>
            <Button variant="default" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="IconButton" note="aria-label is required">
            <IconButton aria-label="Add to favourites" tooltip="Add to favourites">
              <Star />
            </IconButton>
            <IconButton aria-label="Filter" tooltip="Filter records" variant="outline">
              <Filter />
            </IconButton>
            <IconButton aria-label="Delete" tooltip="Move to Trash" variant="danger">
              <Trash2 />
            </IconButton>
            <IconButton aria-label="Delete" disabled>
              <Trash2 />
            </IconButton>
          </Row>
          <Row label="Spinner">
            <Spinner size="xs" />
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" label="Loading records" />
          </Row>
        </Section>

        <Section
          id="input"
          title="Text input"
          summary="Input and Textarea share one shell, so a field and the box under it are the same object at two heights. Both react to aria-invalid — which callers were already setting and nothing was reading."
        >
          <Row label="Size" isColumn>
            <Input size="xs" placeholder="Extra small — inside a grid cell" />
            <Input size="sm" placeholder="Small — toolbars and dense forms" />
            <Input size="md" placeholder="Medium — dialogs and settings" />
          </Row>
          <Row label="State" isColumn>
            <Input placeholder="Default" />
            <Input placeholder="Invalid" aria-invalid />
            <Input placeholder="Disabled" disabled />
            <Input variant="ghost" placeholder="Ghost — the surface already draws a border" />
          </Row>
          <Row label="Textarea" isColumn>
            <Textarea placeholder="Description" rows={3} />
            <Textarea placeholder="With a limit" rows={2} maxLength={120} showCount />
          </Row>
          <Row label="FormField" isColumn>
            <FormField
              label="Workspace name"
              description="Shown in the switcher and on every breadcrumb."
              isRequired
            >
              {(field) => (
                <Input
                  {...field}
                  value={name}
                  placeholder="Nekotic Development"
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField label="Workspace name" error="Give the workspace a name." isRequired>
              {(field) => <Input {...field} value="" readOnly />}
            </FormField>
          </Row>
        </Section>

        <Section
          id="select"
          title="Select"
          summary="Two of them, and the difference is the option. A plain list of strings stays native — keyboard and mobile for free, one DOM node, no portal. An option that carries a colour, an avatar, a description or a reason it is unavailable needs the popover."
        >
          <Row label="Select" note="popover; rich options" isColumn>
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={setStatus}
              aria-label="Status"
              placeholder="Pick a status"
              isClearable
            />
            <Select
              options={PEOPLE_OPTIONS}
              value={owner}
              onValueChange={setOwner}
              aria-label="Owner"
              placeholder="Unassigned"
              isSearchable
            />
            <Select
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={setStatus}
              aria-label="Status, disabled"
              isDisabled
            />
          </Row>
          <FieldDescription className="sm:ml-[10rem]">
            The Done option is disabled and says why on hover. A disabled row that does nothing
            when clicked reads as a broken control; one that explains itself reads as a rule.
          </FieldDescription>
          <Row label="MultiSelect" isColumn>
            <MultiSelect
              options={PEOPLE_OPTIONS}
              values={people}
              onValuesChange={setPeople}
              aria-label="Assignees"
              placeholder="Nobody assigned"
              isSearchable
            />
          </Row>
          <Row label="Combobox" note="search, and create" isColumn>
            <Combobox
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={setStatus}
              aria-label="Status with create"
              onCreate={(label) => setStatus(label.toLowerCase())}
            />
          </Row>
          <Row label="SelectField" note="native; plain lists" isColumn>
            <SelectField aria-label="Sort direction" defaultValue="asc">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </SelectField>
          </Row>
        </Section>

        <Section
          id="date"
          title="Date picker"
          summary="One date, one click — no Apply button, because there is nothing to confirm when the only decision is which square. The value is a day key (2026-08-27) rather than a timestamp: a due date is a square on a calendar, and the zone it gets turned into an instant in is what decides whether the 27th survives being read back. Range, time and multi-select are deliberately absent."
        >
          <Row label="Value" note="controlled" isColumn>
            <DatePicker value={due} onChange={setDue} clearable />
            <DatePicker value={start} onChange={setStart} clearable />
          </Row>

          <Row label="Size" note="the shared control ladder">
            <DatePicker size="xs" value={due} onChange={setDue} className="w-40" />
            <DatePicker size="sm" value={due} onChange={setDue} className="w-40" />
            <DatePicker size="md" value={due} onChange={setDue} className="w-40" />
          </Row>

          <Row label="State" isColumn>
            <DatePicker value={due} onChange={setDue} aria-invalid />
            <DatePicker value={due} onChange={setDue} disabled />
            <DatePicker
              variant="ghost"
              value={due}
              onChange={setDue}
              placeholder="Ghost — the surface already draws a border"
            />
          </Row>

          <Row label="Bounds" note="the rule is the caller's" isColumn>
            <DatePicker
              value={start}
              onChange={setStart}
              minDate="2026-08-24"
              maxDate="2026-09-11"
              placeholder="Inside a window"
              clearable
            />
            <DatePicker
              value={start}
              onChange={setStart}
              isDateDisabled={isWeekendDay}
              placeholder="Weekdays only"
              clearable
            />
          </Row>

          <Row label="FormField" isColumn>
            <FormField label="Due date" description="Shown on the timeline and in My work." isRequired>
              {(field) => <DatePicker {...field} value={due} onChange={setDue} clearable />}
            </FormField>
            <FormField label="Due date" error="End date must be after the start date." isRequired>
              {(field) => <DatePicker {...field} value={due} onChange={setDue} clearable />}
            </FormField>
          </Row>
        </Section>

        <Section
          id="toggles"
          title="Checkbox, switch, radio and segments"
          summary="Four controls, four jobs. A checkbox selects; a switch persists a setting; a radio group picks one of a few; a segmented control picks one of a few that live on a toolbar."
        >
          <Row label="Checkbox">
            <Checkbox checked={isChecked} onChange={() => setIsChecked((value) => !value)} />
            <Checkbox checked={false} isIndeterminate />
            <Checkbox checked={false} onChange={() => {}} />
            <Checkbox checked disabled onChange={() => {}} />
          </Row>
          <Row label="Switch" note="role=switch">
            <Switch checked={isOn} onCheckedChange={setIsOn} aria-label="Show dependencies" />
            <Switch checked={false} onCheckedChange={() => {}} aria-label="Off" />
            <Switch checked size="sm" onCheckedChange={() => {}} aria-label="Small" />
            <Switch checked disabled onCheckedChange={() => {}} aria-label="Disabled" />
          </Row>
          <Row label="RadioGroup" isColumn>
            <RadioGroup value={access} onValueChange={setAccess} label="Access">
              <RadioGroupItem
                value="inherit"
                label="Inherit from parent"
                description="Whoever can see the folder this sits in."
              />
              <RadioGroupItem
                value="workspace"
                label="All workspace members"
                description="Everyone in the workspace, whatever the parent says."
              />
              <RadioGroupItem
                value="restricted"
                label="Restricted"
                description="Only the people listed below."
              />
            </RadioGroup>
          </Row>
          <Row label="RadioCard" isColumn>
            <RadioGroup
              value={density}
              onValueChange={setDensity}
              listClassName="grid grid-cols-2 gap-2"
            >
              <RadioCard
                value="comfortable"
                layout="stack"
                label="Comfortable"
                description="44px rows"
              />
              <RadioCard value="compact" layout="stack" label="Compact" description="32px rows" />
            </RadioGroup>
          </Row>
          <Row label="ToggleGroup">
            <ToggleGroup value={density} onValueChange={setDensity} aria-label="Row density">
              <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
              <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
            </ToggleGroup>
          </Row>
        </Section>

        <Section
          id="display"
          title="Badge, chip and avatar"
          summary="A badge labels a state. A chip is a value, and can usually be taken back off. The distinction matters because they were the same component six times over."
        >
          <Row label="Badge">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="success">Passed</Badge>
            <Badge variant="warning">At risk</Badge>
            <Badge variant="danger">Blocked</Badge>
            <CountBadge>12</CountBadge>
          </Row>
          <Row label="Chip" note="the option palette">
            {SELECT_COLORS.slice(0, 5).map((color) => (
              <Chip key={color} color={color} leading={<ChipDot color={color} variant="solid" />}>
                {color}
              </Chip>
            ))}
            <Chip color="blue" onRemove={() => {}}>
              Removable
            </Chip>
            <Chip variant="placeholder">No value</Chip>
          </Row>
          <Row label="Avatar" note="16 / 20 / 24 / 28 / 32">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
              <Avatar key={size} size={size}>
                <AvatarFallback>TN</AvatarFallback>
              </Avatar>
            ))}
          </Row>
        </Section>

        <Section
          id="overlay"
          title="Dialog, tabs and tooltip"
          summary="Every overlay is one primitive with a size, not a bespoke shell per feature. Twenty consumers had written six different header strings between them."
        >
          <Row label="Dialog">
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              Open dialog
            </Button>
          </Row>
          <Row label="Tabs" isColumn>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label="Record sections">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="py-3 text-ui text-muted-foreground">
                Arrow keys move between tabs; Tab enters the strip once and leaves it once.
              </TabsContent>
              <TabsContent value="comments" className="py-3 text-ui text-muted-foreground">
                The pill variant carries unread counts on the notification inbox.
              </TabsContent>
              <TabsContent value="activity" className="py-3 text-ui text-muted-foreground">
                Three copies of this strip existed; two were byte-identical.
              </TabsContent>
            </Tabs>
          </Row>
          <Row label="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Explains, never repeats the label</TooltipContent>
            </Tooltip>
          </Row>
        </Section>

        <Section
          id="states"
          title="Loading, empty and error"
          summary="The non-happy paths are a shared shell so they read the same wherever the reader lands on one."
        >
          <Row label="Skeleton" isColumn>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-32" />
          </Row>
          <Row label="Empty" isColumn>
            <EmptyState
              icon={Star}
              title="No favourites yet"
              description="Star a board or a page and it appears here."
            />
          </Row>
          <Row label="Error" isColumn>
            <ErrorState
              error={{
                code: "unknown",
                message: "Couldn't load records",
                detail: "The request did not come back. Nothing was changed.",
                isRetryable: true,
              }}
              onRetry={() => {}}
            />
          </Row>
        </Section>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>
                A workspace holds its own drive, its own people and its own permissions.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <FormField label="Workspace name" isRequired>
                {(field) => <Input {...field} placeholder="Nekotic Development" />}
              </FormField>
              <FormField label="Description">
                {(field) => <Textarea {...field} rows={3} placeholder="What it is for" />}
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="default">Create workspace</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function isWeekendDay(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}
