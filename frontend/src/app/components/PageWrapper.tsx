import { ReactNode } from "react";

type PageWrapperProps = {
  children: ReactNode;
};

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div>
      <main>
        <div className="d-flex justify-content-center align-items-start flex-column mt-5">
          <div className="container ms-2 ms-md-5 ps-3 py-3 border-5 border-start border-primary">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
