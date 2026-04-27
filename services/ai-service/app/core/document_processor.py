import logging
import tempfile
import os
import requests
from pathlib import Path

from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredWordDocumentLoader,
    WebBaseLoader,
)
from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_splitter() -> RecursiveCharacterTextSplitter:
    settings = get_settings()
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
        length_function=len,
    )


def _download_to_temp(url: str, suffix: str) -> str:
    """Download a file from URL to a temp file, return the path."""
    response = requests.get(url, timeout=30, stream=True)
    response.raise_for_status()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    for chunk in response.iter_content(chunk_size=8192):
        tmp.write(chunk)
    tmp.flush()
    tmp.close()
    return tmp.name


def load_and_chunk(
    file_url: str,
    document_type: str,
    document_name: str,
) -> list[Document]:
    """
    Load a document from a URL and split it into chunks.
    Returns a list of LangChain Documents ready for embedding.
    """
    doc_type = document_type.upper()
    raw_docs: list[Document] = []
    tmp_path: str | None = None

    try:
        if doc_type == "URL":
            # Crawl the web page
            loader = WebBaseLoader([file_url])
            loader.requests_kwargs = {"timeout": 15}
            raw_docs = loader.load()

        elif doc_type == "PDF":
            tmp_path = _download_to_temp(file_url, ".pdf")
            loader = PyPDFLoader(tmp_path)
            raw_docs = loader.load()

        elif doc_type == "DOCX":
            tmp_path = _download_to_temp(file_url, ".docx")
            loader = UnstructuredWordDocumentLoader(tmp_path)
            raw_docs = loader.load()

        elif doc_type in ("TXT", "MARKDOWN"):
            tmp_path = _download_to_temp(file_url, ".txt")
            loader = TextLoader(tmp_path, encoding="utf-8")
            raw_docs = loader.load()

        else:
            raise ValueError(f"Unsupported document type: {doc_type}")

        if not raw_docs:
            logger.warning(f"No content extracted from {document_name}")
            return []

        splitter = _get_splitter()
        chunks = splitter.split_documents(raw_docs)

        # Clean up and tag each chunk
        result = []
        for i, chunk in enumerate(chunks):
            text = chunk.page_content.strip()
            if len(text) < 30:  # Skip tiny fragments
                continue
            result.append(
                Document(
                    page_content=text,
                    metadata={
                        "document_name": document_name,
                        "chunk_index": i,
                        "source": file_url,
                    },
                )
            )

        logger.info(f"Processed '{document_name}': {len(result)} chunks from {len(raw_docs)} pages")
        return result

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
