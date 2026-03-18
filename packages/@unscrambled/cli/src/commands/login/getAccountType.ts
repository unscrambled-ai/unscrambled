import { prompt } from "enquirer";

export default async function getAccountType(): Promise<"new" | "existing"> {
  const response: { accountType: string } = await prompt({
    type: "select",
    name: "accountType",
    message: "Select account type",
    choices: [
      { name: "new", message: "Create new account" },
      { name: "existing", message: "Use existing account" },
    ],
  });

  if (response.accountType === "new") {
    return "new";
  }

  return "existing";
}
