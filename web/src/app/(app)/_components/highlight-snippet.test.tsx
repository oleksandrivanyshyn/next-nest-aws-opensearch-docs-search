import { render, screen } from '@testing-library/react';
import { HighlightSnippet } from './highlight-snippet';

describe('HighlightSnippet', () => {
  it('wraps the text between sentinels in a mark element', () => {
    const { container } = render(
      <HighlightSnippet fragment="quarterly [[HL]]revenue[[/HL]] grew" />,
    );

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('revenue');
  });

  it('keeps the surrounding text outside the mark', () => {
    render(<HighlightSnippet fragment="quarterly [[HL]]revenue[[/HL]] grew" />);

    expect(screen.getByText(/quarterly/)).toBeDefined();
    expect(screen.getByText(/grew/)).toBeDefined();
  });

  it('renders markup from the document as visible text, never as html', () => {
    const { container } = render(
      <HighlightSnippet fragment='<img src=x onerror="alert(1)"> [[HL]]onerror[[/HL]]' />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('does not treat a script tag in the fragment as markup', () => {
    const { container } = render(
      <HighlightSnippet fragment="[[HL]]payload[[/HL]] <script>alert(1)</script>" />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders a fragment with no match as plain text', () => {
    const { container } = render(
      <HighlightSnippet fragment="nothing matched here" />,
    );

    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('nothing matched here');
  });
});
