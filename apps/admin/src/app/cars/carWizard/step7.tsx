import { Anchor, Checkbox } from "@mantine/core";

export default function Step7({ agreed, onChange }: any) {
  return (
    <>
      <p className="font-bold text-lg">One last thing!</p>
      <p className=" text-gray-600 pt-3">
        Before you can share your car with others we need you to accept our
        terms below.
      </p>
      <div className="mt-5">
        <Checkbox
          checked={agreed}
          label={
            <>
              I accept{" "}
              <Anchor
                href="https://mini2go.rent"
                target="_blank"
                inherit
                c={"green"}
              >
                terms and conditions{" "}
              </Anchor>
              on MINI2go.
            </>
          }
          onChange={(e) => onChange("agreed", e.currentTarget.checked)}
          size="md"
          color="black"
          radius="md"
        />
      </div>
    </>
  );
}
