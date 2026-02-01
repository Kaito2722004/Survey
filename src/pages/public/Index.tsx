import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { useEffect } from 'react';
import {
  FileText,
  Zap,
  BarChart3,
  Link as LinkIcon,
  Shield,
  ArrowRight,
  Check,
} from 'lucide-react';

const features = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Dynamic Builder',
    description: 'Create surveys with multiple question types in minutes.',
  },
  {
    icon: <LinkIcon className="h-6 w-6" />,
    title: 'Easy Sharing',
    description: 'Share via unique links. No login required for respondents.',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Real-time Analytics',
    description: 'View responses instantly with beautiful charts.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Secure & Private',
    description: 'Your data is encrypted and secure.',
  },
];

const questionTypes = [
  'Short Answer',
  'Paragraph',
  'Multiple Choice',
  'Checkboxes',
  'Dropdown',
];

const Index = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="container py-20 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Beautiful surveys made simple
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Create stunning surveys in{' '}
            <span className="gradient-text">minutes</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Build, share, and analyze surveys with our intuitive form builder.
            Get responses fast and understand your audience better.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="xl" onClick={() => navigate('/signup')}>
              Start Building Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="xl" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border bg-secondary/30 py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-foreground">
              Everything you need
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features to create and manage your surveys
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="card-elevated card-hover p-6"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Question Types Section */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-semibold text-foreground">
              Multiple question types
            </h2>
            <p className="mb-10 text-lg text-muted-foreground">
              Choose from a variety of question formats to create engaging surveys
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {questionTypes.map((type, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
                >
                  <Check className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-foreground">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-semibold text-foreground">
              Ready to get started?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Create your first survey in minutes. No credit card required.
            </p>
            <Button size="xl" onClick={() => navigate('/signup')}>
              Create Your First Survey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">FormFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 FormFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
