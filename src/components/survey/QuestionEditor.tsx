import { useState } from 'react';
import { Question, QuestionType, QuestionOption } from '@/types/survey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  X,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';

interface QuestionEditorProps {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  dragHandleProps?: any;
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
  { value: 'short_answer', label: 'Short Answer', icon: <Type className="h-4 w-4" /> },
  { value: 'paragraph', label: 'Paragraph', icon: <AlignLeft className="h-4 w-4" /> },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: <CircleDot className="h-4 w-4" /> },
  { value: 'checkbox', label: 'Checkboxes', icon: <CheckSquare className="h-4 w-4" /> },
  { value: 'dropdown', label: 'Dropdown', icon: <ChevronDown className="h-4 w-4" /> },
];

export const QuestionEditor = ({ question, onUpdate, onDelete, dragHandleProps }: QuestionEditorProps) => {
  const hasOptions = ['multiple_choice', 'checkbox', 'dropdown'].includes(question.type);

  const addOption = () => {
    const newOption: QuestionOption = {
      id: crypto.randomUUID(),
      text: `Option ${(question.options?.length || 0) + 1}`,
    };
    onUpdate({ options: [...(question.options || []), newOption] });
  };

  const updateOption = (optionId: string, text: string) => {
    onUpdate({
      options: question.options?.map(opt =>
        opt.id === optionId ? { ...opt, text } : opt
      ),
    });
  };

  const deleteOption = (optionId: string) => {
    onUpdate({
      options: question.options?.filter(opt => opt.id !== optionId),
    });
  };

  return (
    <div className="card-elevated animate-scale-in group relative overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2">
        <div 
          {...dragHandleProps} 
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <Select value={question.type} onValueChange={(value: QuestionType) => onUpdate({ type: value })}>
          <SelectTrigger className="w-[180px] border-0 bg-transparent shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  {type.icon}
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <Input
            value={question.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Question title"
            className="border-0 border-b border-border bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0"
          />
        </div>

        {hasOptions && (
          <div className="space-y-2 pl-4">
            {question.options?.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2">
                {question.type === 'multiple_choice' && (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                )}
                {question.type === 'checkbox' && (
                  <div className="h-4 w-4 rounded border-2 border-muted-foreground/40" />
                )}
                {question.type === 'dropdown' && (
                  <span className="text-sm text-muted-foreground">{index + 1}.</span>
                )}
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(option.id, e.target.value)}
                  className="flex-1 border-0 border-b border-transparent bg-transparent px-0 shadow-none focus:border-border focus-visible:ring-0"
                />
                {(question.options?.length || 0) > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => deleteOption(option.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" className="mt-2" onClick={addOption}>
              <Plus className="mr-1 h-4 w-4" />
              Add Option
            </Button>
          </div>
        )}

        {!hasOptions && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
            <p className="text-sm text-muted-foreground">
              {question.type === 'short_answer' ? 'Short answer text' : 'Long answer text'}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 border-t border-border bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Label htmlFor={`required-${question.id}`} className="text-sm text-muted-foreground">
            Required
          </Label>
          <Switch
            id={`required-${question.id}`}
            checked={question.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
          />
        </div>
      </div>
    </div>
  );
};
