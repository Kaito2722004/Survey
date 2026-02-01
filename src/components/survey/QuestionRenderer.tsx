import { Question } from '@/types/survey';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QuestionRendererProps {
  question: Question;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  error?: string;
}

export const QuestionRenderer = ({ question, value, onChange, error }: QuestionRendererProps) => {
  const handleCheckboxChange = (optionId: string, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    if (checked) {
      onChange([...currentValues, optionId]);
    } else {
      onChange(currentValues.filter(v => v !== optionId));
    }
  };

  return (
    <div className="card-elevated animate-slide-up p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-foreground">
          {question.title}
          {question.required && <span className="ml-1 text-destructive">*</span>}
        </h3>
        {question.description && (
          <p className="mt-1 text-sm text-muted-foreground">{question.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {question.type === 'short_answer' && (
          <Input
            placeholder="Your answer"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-destructive' : ''}
          />
        )}

        {question.type === 'paragraph' && (
          <Textarea
            placeholder="Your answer"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={error ? 'border-destructive' : ''}
          />
        )}

        {question.type === 'multiple_choice' && (
          <RadioGroup
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
            className="space-y-2"
          >
            {question.options?.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="font-normal cursor-pointer">
                  {option.text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === 'checkbox' && (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <Checkbox
                  id={option.id}
                  checked={Array.isArray(value) && value.includes(option.id)}
                  onCheckedChange={(checked) => handleCheckboxChange(option.id, checked as boolean)}
                />
                <Label htmlFor={option.id} className="font-normal cursor-pointer">
                  {option.text}
                </Label>
              </div>
            ))}
          </div>
        )}

        {question.type === 'dropdown' && (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
          >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder="Choose an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
