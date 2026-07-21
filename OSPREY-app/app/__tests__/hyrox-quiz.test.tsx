import React from 'react';
import { renderWithProviders as render, screen, fireEvent } from '@/test-utils/render';
import HyroxQuiz from '@/../app/hyrox-quiz';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));

// getAllByRole('button')[0] is ScreenHeader's "Go back" chevron — it always
// renders before the ScrollView content, so index [1] is the first answer
// option. Confirmed by inspecting the rendered accessibility tree.
const FIRST_OPTION_INDEX = 1;

describe('hyrox-quiz', () => {
  it('renders the first question on load', () => {
    render(<HyroxQuiz />);
    expect(screen.getByText(/Question 1 of 10/i)).toBeTruthy();
  });

  it('shows feedback after answering, and a Next Question button', () => {
    render(<HyroxQuiz />);
    fireEvent.press(screen.getAllByRole('button')[FIRST_OPTION_INDEX]);
    expect(screen.getByText(/Next Question/i)).toBeTruthy();
  });

  it('advances to question 2 of 10 after pressing Next', () => {
    render(<HyroxQuiz />);
    fireEvent.press(screen.getAllByRole('button')[FIRST_OPTION_INDEX]);
    fireEvent.press(screen.getByText(/Next Question/i));
    expect(screen.getByText(/Question 2 of 10/i)).toBeTruthy();
  });

  it('shows a final score screen with a Try Again button after the last question', () => {
    render(<HyroxQuiz />);
    for (let i = 0; i < 10; i++) {
      fireEvent.press(screen.getAllByRole('button')[FIRST_OPTION_INDEX]);
      const isLast = i === 9;
      fireEvent.press(screen.getByText(isLast ? /See Results/i : /Next Question/i));
    }
    expect(screen.getByText(/\/10/)).toBeTruthy();
    expect(screen.getByText(/Try Again/i)).toBeTruthy();
  });

  it('Try Again resets back to question 1', () => {
    render(<HyroxQuiz />);
    for (let i = 0; i < 10; i++) {
      fireEvent.press(screen.getAllByRole('button')[FIRST_OPTION_INDEX]);
      fireEvent.press(screen.getByText(i === 9 ? /See Results/i : /Next Question/i));
    }
    fireEvent.press(screen.getByText(/Try Again/i));
    expect(screen.getByText(/Question 1 of 10/i)).toBeTruthy();
  });
});
