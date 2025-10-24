import os
import stat

def get_permissions(path):
    file_stat = os.stat(path)
    permissions = stat.filemode(file_stat.st_mode)
    return permissions

def print_directory_structure(root_dir, level=0, is_last=True):
    items = os.listdir(root_dir)
    items_count = len(items)

    for index, item in enumerate(items):
        item_path = os.path.join(root_dir, item)

        # Пропускаем папку node_modules
        if item == 'node_modules':
            continue
        
        # Определяем, является ли текущий элемент последним в уровне
        is_last_item = index == items_count - 1
        connector = '└─ ' if is_last_item else '├─ '

        permissions = get_permissions(item_path)
        print(' ' * (level * 4) + connector + f'{item} ({permissions})')

        if os.path.isdir(item_path):
            # Рекурсивный вызов для поддиректорий, передаем is_last_item
            print_directory_structure(item_path, level + 1, is_last_item)


root_directory = '/home/olaynick/Рабочий стол/sfua fe'
print_directory_structure(root_directory)