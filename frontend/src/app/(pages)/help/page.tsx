export default function HelpPage() {
  return (
    <main>
      <div className="container">
        <h2 className="my-3">How to use this download service</h2>
        <p>
          This web application gives you the opportunity to view and download
          datasets that you have access to and explore the files they contain.
          To be able to download files or a full dataset you will have to
          provide information from a key file, see details below. You can also
          download checksums for the relevant files to verify a correct
          download.
        </p>
        <h3>Before you start</h3>
        <p>
          While you can use this application on any device with internet access,
          we think that you will have the best experience on a relatively large
          screen like a laptop or desktop computer. If you want to download
          files the experience will be different depending on the web browser
          that you are using. You find details about this in the download
          section.
        </p>
        <h3>Login</h3>
        <p>
          To be able to view and explore datasets you have to log in using you
          LSAAI-account.
        </p>
        <h3>View datasets</h3>
        <p>
          The datasets that you can see listed under "Datasets" are all datasets
          in this archive that you have access to. Which datasets you can access
          is defined by ...
        </p>
        <h3>Explore a dataset</h3>
        <p>
          From the list of datasets you can navigate to a specific dataset to
          see the files it contains. Currently, there is now way to show the
          inner folder structure of a dataset but you can see the path for each
          file. You can filter and search for certain files or file paths and
          see each file's checksum. If you want to download anything you first
          have to upload a public key.
        </p>
        <h3>Upload a Crypt4GH public key for downloading</h3>
        <p>
          public key file. This can be created either with a specific crypt4gh
          utility, e.g.{" "}
          <a href="https://github.com/neicnordic/crypt4gh#crypt4gh">
            NeIC crypt4gh <i className="bi bi-box-arrow-up-right ms-1"></i>
          </a>
          or with the command line interface for sda{" "}
          <a href="https://github.com/NBISweden/sda-cli#sda-cli">
            sda-sli <i className="bi bi-box-arrow-up-right ms-1"></i>
          </a>
          A "key-pair" can be created with either of those tools and then the
          public part of that can be uploaded. If you have used a different
          service to generate a key pair you can instead upload the file content
          of your public key file directly.
        </p>
        <h3>Download files</h3>
        <p>
          Once you have uploaded a public key you can browse back to view a
          certain dataset and start downloading files that you have selected.
          The download process looks different depending on your web browser.
        </p>
        <h4>Chrome and other chromium based browsers</h4>
        <p>
          The download button will trigger a popup asking you for permission to
          let the browser access your local file system. If you grant access the
          files will be downloaded directly to the folder you choose. The
          download will be interrupted if you close the browser window, close
          the tab or move away from it. If you try downloading the same files
          into the same folder at a later point the download will resume from
          where it was interrupted.
        </p>
        <h4>Other browsers</h4>
        <p>
          Other web browsers currently don't allow the direct access to the file
          system. You can instead download a tar file that you then can unpack
          manually on your local machine.{" "}
        </p>
        <h3>Download a full dataset</h3>
        <p>
          Downloading a full dataset in one click is currently not possible
          using only this web application. However, it is possible using the
          connected command line interface. The button "Download full dataset"
          will provide you with detailed instructions on how to donwload the
          dataset via the command line tool.
        </p>
        <h3>Download checksums</h3>
        <p>
          In every dataset you have the option to download file checksums. We
          support sha256 and md5 checksums. If you want to download the checksum
          for a single file you can download any format that is available for
          this file. You can also download all checksums for a number of
          selected files as long as all files have the same checksum format
          available. The resulting file will contain the checksums in the
          standard format that is used by most checksum verification tools. If
          all files in a dataset have available checksums in the same format you
          can download all checksums for the dataset in one click using the
          button "Download file checksums".
        </p>
      </div>
    </main>
  );
}
