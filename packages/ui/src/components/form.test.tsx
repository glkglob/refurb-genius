import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, it, expect } from "vitest";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@repo/ui";
import { Input } from "@repo/ui";

function TestForm() {
  const form = useForm({ defaultValues: { username: "" } });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="username" {...field} />
              </FormControl>
              <FormDescription>This is your public handle.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

describe("Form (migrated @repo/ui)", () => {
  it("renders form fields with label, control, description", () => {
    render(<TestForm />);

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("username")).toBeInTheDocument();
    expect(screen.getByText("This is your public handle.")).toBeInTheDocument();
  });
});
