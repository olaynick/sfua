import os
import pathlib

def collect_files_content(folder_path, output_file="project_content.txt"):
    """
    Собирает содержимое всех файлов в папке и создает итоговый файл
    """
    # Поддерживаемые расширения файлов
    supported_extensions = {'.html', '.css', '.js','.json', '.xml'}
    
    # Получаем абсолютный путь к папке
    folder_path = os.path.abspath(folder_path)
    
    with open(output_file, 'w', encoding='utf-8') as output:
        # Сначала собираем все файлы
        all_files = []
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                file_ext = pathlib.Path(file).suffix.lower()
                
                # Пропускаем системные файлы и сам выходной файл
                if (file.startswith('.') or file == output_file or 
                    file.startswith('__') or file == 'Thumbs.db'):
                    continue
                
                # Добавляем файл, даже если расширение не поддерживается
                all_files.append(file_path)
        
        # Обрабатываем файлы
        for file_path in all_files:
            try:
                relative_path = os.path.relpath(file_path, folder_path)
                file_ext = pathlib.Path(file_path).suffix.lower()
                
                # Записываем заголовок файла
                output.write(f"\n{relative_path}:\n")
                output.write("-" * 50 + "\n")
                
                # Читаем и записываем содержимое файла
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    output.write(content)
                    output.write("\n\n")
                    
            except Exception as e:
                output.write(f"Ошибка при чтении файла {file_path}: {str(e)}\n\n")
        
        # Добавляем структуру проекта в конце
        output.write("\n" + "="*60 + "\n")
        output.write("СТРУКТУРА ПРОЕКТА:\n")
        output.write("="*60 + "\n")
        generate_directory_tree(folder_path, output)

def generate_directory_tree(start_path, output_file, prefix=''):
    """
    Генерирует ASCII структуру каталогов
    """
    if not os.path.exists(start_path):
        output_file.write(f"Путь не существует: {start_path}\n")
        return
    
    if os.path.isfile(start_path):
        output_file.write(f"{prefix}📄 {os.path.basename(start_path)}\n")
        return
    
    items = os.listdir(start_path)
    items = [item for item in items if not item.startswith('.') and item != '__pycache__']
    items.sort()
    
    for i, item in enumerate(items):
        path = os.path.join(start_path, item)
        is_last = i == len(items) - 1
        
        if os.path.isdir(path):
            output_file.write(f"{prefix}{'└── ' if is_last else '├── '}📁 {item}/\n")
            new_prefix = prefix + ('    ' if is_last else '│   ')
            generate_directory_tree(path, output_file, new_prefix)
        else:
            output_file.write(f"{prefix}{'└── ' if is_last else '├── '}📄 {item}\n")

if __name__ == "__main__":
    # Укажите путь к вашей папке
    folder_to_scan = input("Введите путь к папке (или нажмите Enter для текущей папки): ").strip()
    
    if not folder_to_scan:
        folder_to_scan = "."
    
    if os.path.exists(folder_to_scan):
        output_filename = "project_content.txt"
        collect_files_content(folder_to_scan, output_filename)
        print(f"Файл {output_filename} успешно создан!")
    else:
        print("Указанная папка не существует!")